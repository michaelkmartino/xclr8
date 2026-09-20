import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq, max } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import * as schema from '../db/schema.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { CreateVersionDto } from './dto/create-version.dto.js';
import { LockDto } from './dto/lock.dto.js';

const LOCK_TIMEOUT_MINUTES = 15;

@Injectable()
export class QuotesService {
  constructor(@Inject(DB) private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Creating a Quote always creates its first Quote Version too — a bare
   * Quote with no version isn't useful, and this matches how the spec
   * describes versions as snapshots of "the quote."
   */
  async createForJob(jobId: string, dto: CreateQuoteDto) {
    const [job] = await this.db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    return this.db.transaction(async (tx) => {
      const [quote] = await tx
        .insert(schema.quotes)
        .values({ jobId, bidPackage: dto.bidPackage ?? 'Base Bid' })
        .returning();

      const [version] = await tx
        .insert(schema.quoteVersions)
        .values({ quoteId: quote.id, versionNumber: 1, label: 'Initial', isReporting: true })
        .returning();

      return { ...quote, versions: [version] };
    });
  }

  /**
   * Powers the "recent quotes" list on the Jobs landing page — every
   * version across every job, newest activity first, so anyone opening the
   * app sees what's actively being worked on and by whom (2026-09-19).
   */
  async findRecentVersions(limit = 15) {
    return this.db
      .select({
        versionId: schema.quoteVersions.id,
        quoteId: schema.quoteVersions.quoteId,
        versionNumber: schema.quoteVersions.versionNumber,
        label: schema.quoteVersions.label,
        isReporting: schema.quoteVersions.isReporting,
        lockHolderName: schema.quoteVersions.lockHolderName,
        updatedAt: schema.quoteVersions.updatedAt,
        lastEditedBy: schema.quoteVersions.lastEditedBy,
        bidPackage: schema.quotes.bidPackage,
        jobId: schema.jobs.id,
        jobName: schema.jobs.name,
      })
      .from(schema.quoteVersions)
      .innerJoin(schema.quotes, eq(schema.quotes.id, schema.quoteVersions.quoteId))
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.quotes.jobId))
      .orderBy(desc(schema.quoteVersions.updatedAt))
      .limit(limit);
  }

  findAllForJob(jobId: string) {
    return this.db.select().from(schema.quotes).where(eq(schema.quotes.jobId, jobId));
  }

  async findOne(id: string) {
    const [quote] = await this.db.select().from(schema.quotes).where(eq(schema.quotes.id, id));
    if (!quote) return null;
    const versions = await this.db
      .select()
      .from(schema.quoteVersions)
      .where(eq(schema.quoteVersions.quoteId, id))
      .orderBy(desc(schema.quoteVersions.versionNumber));
    return { ...quote, versions };
  }

  /**
   * New version either copies an existing version's line items and price
   * columns, or starts completely empty — the user is asked which, every
   * time, at "create new version" (confirmed 2026-09-19; previously this
   * always copied). Not marked reporting by default — that's a separate,
   * explicit choice (setReporting), matching the "Use this version for
   * Salesforce reporting?" prompt described in the roadmap.
   */
  async createVersion(quoteId: string, dto: CreateVersionDto) {
    const quote = await this.findOne(quoteId);
    if (!quote) throw new NotFoundException(`Quote ${quoteId} not found`);

    const sourceVersionId = dto.blank
      ? null
      : (dto.copyFromVersionId ?? quote.versions.find((v) => v.isReporting)?.id ?? quote.versions[0]?.id);
    if (!dto.blank && !sourceVersionId) {
      throw new BadRequestException('No existing version to copy from');
    }

    return this.db.transaction(async (tx) => {
      const [{ value: maxVersion }] = await tx
        .select({ value: max(schema.quoteVersions.versionNumber) })
        .from(schema.quoteVersions)
        .where(eq(schema.quoteVersions.quoteId, quoteId));

      const [newVersion] = await tx
        .insert(schema.quoteVersions)
        .values({
          quoteId,
          versionNumber: (maxVersion ?? 0) + 1,
          label: dto.label,
          isReporting: false,
        })
        .returning();

      if (!sourceVersionId) {
        return newVersion;
      }

      // Carry over this quote's manufacturer commission overrides too, so a
      // copied version keeps the same effective rates as its source
      // (2026-09-19).
      const sourceOverrides = await tx
        .select()
        .from(schema.quoteManufacturerCommissions)
        .where(eq(schema.quoteManufacturerCommissions.quoteVersionId, sourceVersionId));
      if (sourceOverrides.length > 0) {
        await tx.insert(schema.quoteManufacturerCommissions).values(
          sourceOverrides.map((o) => ({
            quoteVersionId: newVersion.id,
            manufacturerId: o.manufacturerId,
            commissionPct: o.commissionPct,
            overageSplitPct: o.overageSplitPct,
          })),
        );
      }

      const sourceLineItems = await tx
        .select()
        .from(schema.lineItems)
        .where(eq(schema.lineItems.quoteVersionId, sourceVersionId));

      for (const li of sourceLineItems) {
        const [newLineItem] = await tx
          .insert(schema.lineItems)
          .values({
            quoteVersionId: newVersion.id,
            lineNumber: li.lineNumber,
            quantity: li.quantity,
            fixtureType: li.fixtureType,
            manufacturerId: li.manufacturerId,
            partNumber: li.partNumber,
            partDescription: li.partDescription,
            notes: li.notes,
            dnBase: li.dnBase,
            commissionPct: li.commissionPct,
            overageSplitPct: li.overageSplitPct,
            isNote: li.isNote,
            noteText: li.noteText,
            internalOnly: li.internalOnly,
          })
          .returning();

        if (li.isNote) continue; // notes have no price columns to copy

        const sourceColumns = await tx
          .select()
          .from(schema.priceColumns)
          .where(eq(schema.priceColumns.lineItemId, li.id));

        if (sourceColumns.length > 0) {
          await tx.insert(schema.priceColumns).values(
            sourceColumns.map((pc) => ({
              lineItemId: newLineItem.id,
              columnLabel: pc.columnLabel,
              multiplier: pc.multiplier,
              columnOrder: pc.columnOrder,
            })),
          );
        }
      }

      return newVersion;
    });
  }

  /** Exactly one Quote Version per Quote holds isReporting = true, per the spec. */
  async setReporting(quoteId: string, versionId: string) {
    const [version] = await this.db
      .select()
      .from(schema.quoteVersions)
      .where(and(eq(schema.quoteVersions.id, versionId), eq(schema.quoteVersions.quoteId, quoteId)));
    if (!version) throw new NotFoundException(`Version ${versionId} not found on quote ${quoteId}`);

    return this.db.transaction(async (tx) => {
      await tx
        .update(schema.quoteVersions)
        .set({ isReporting: false })
        .where(eq(schema.quoteVersions.quoteId, quoteId));
      const [updated] = await tx
        .update(schema.quoteVersions)
        .set({ isReporting: true })
        .where(eq(schema.quoteVersions.id, versionId))
        .returning();
      return updated;
    });
  }

  private isLockExpired(lockAcquiredAt: Date | null): boolean {
    if (!lockAcquiredAt) return true;
    const ageMinutes = (Date.now() - new Date(lockAcquiredAt).getTime()) / 60000;
    return ageMinutes > LOCK_TIMEOUT_MINUTES;
  }

  private async getVersionOrThrow(versionId: string) {
    const [version] = await this.db
      .select()
      .from(schema.quoteVersions)
      .where(eq(schema.quoteVersions.id, versionId));
    if (!version) throw new NotFoundException(`Quote version ${versionId} not found`);
    return version;
  }

  /**
   * Pessimistic locking, matching Cahill's current behavior: only one user
   * edits a given quote version at a time. A lock auto-releases after
   * LOCK_TIMEOUT_MINUTES of inactivity so a crashed session doesn't
   * permanently block others.
   */
  async acquireLock(versionId: string, dto: LockDto) {
    const version = await this.getVersionOrThrow(versionId);

    const isHeldByOther = version.lockHolderName && version.lockHolderName !== dto.userName;
    if (isHeldByOther && !this.isLockExpired(version.lockAcquiredAt)) {
      throw new ConflictException(
        `Quote version is locked by ${version.lockHolderName} (since ${version.lockAcquiredAt}). Try again once they release it, or ask an admin to force-unlock.`,
      );
    }

    const [updated] = await this.db
      .update(schema.quoteVersions)
      .set({ lockHolderName: dto.userName, lockAcquiredAt: new Date(), updatedAt: new Date(), lastEditedBy: dto.userName })
      .where(eq(schema.quoteVersions.id, versionId))
      .returning();
    return updated;
  }

  /** Only the current holder can release their own lock (force-unlock is separate). */
  async releaseLock(versionId: string, dto: LockDto) {
    const version = await this.getVersionOrThrow(versionId);
    if (version.lockHolderName && version.lockHolderName !== dto.userName && !this.isLockExpired(version.lockAcquiredAt)) {
      throw new ForbiddenException(`This lock is held by ${version.lockHolderName}, not ${dto.userName}`);
    }
    const [updated] = await this.db
      .update(schema.quoteVersions)
      .set({ lockHolderName: null, lockAcquiredAt: null })
      .where(eq(schema.quoteVersions.id, versionId))
      .returning();
    return updated;
  }

  /**
   * Admin override — clears the lock regardless of who holds it. The spec
   * calls for every force-unlock to be logged; this logs to the server
   * console for now (a proper audit trail table is a later refinement).
   */
  async forceUnlock(versionId: string, dto: LockDto) {
    const version = await this.getVersionOrThrow(versionId);
    console.log(
      `[AUDIT] Force-unlock: ${dto.userName} force-unlocked quote version ${versionId} ` +
        `(previously held by ${version.lockHolderName ?? 'nobody'}) at ${new Date().toISOString()}`,
    );
    const [updated] = await this.db
      .update(schema.quoteVersions)
      .set({ lockHolderName: null, lockAcquiredAt: null })
      .where(eq(schema.quoteVersions.id, versionId))
      .returning();
    return updated;
  }
}
