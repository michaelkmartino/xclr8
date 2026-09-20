import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, eq, max } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import * as schema from '../db/schema.js';
import { CreateLineItemDto } from './dto/create-line-item.dto.js';
import { CreatePriceColumnDto } from './dto/create-price-column.dto.js';
import { SetCommissionStructureDto } from './dto/set-commission-structure.dto.js';

const MAX_PRICE_COLUMNS = 10;

@Injectable()
export class LineItemsService {
  constructor(@Inject(DB) private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Line # is always server-assigned (next number in this version's
   * sequence) — never client-editable (2026-09-19). Notes share the same
   * sequence so they keep their place among the fixture lines.
   */
  private async nextLineNumber(quoteVersionId: string) {
    const [{ value }] = await this.db
      .select({ value: max(schema.lineItems.lineNumber) })
      .from(schema.lineItems)
      .where(eq(schema.lineItems.quoteVersionId, quoteVersionId));
    return (value ?? 0) + 1;
  }

  async createForVersion(quoteVersionId: string, dto: CreateLineItemDto) {
    const [version] = await this.db
      .select()
      .from(schema.quoteVersions)
      .where(eq(schema.quoteVersions.id, quoteVersionId));
    if (!version) throw new NotFoundException(`Quote version ${quoteVersionId} not found`);

    const { editedBy, isNote, ...rest } = dto;
    const lineNumber = await this.nextLineNumber(quoteVersionId);

    if (isNote) {
      const [lineItem] = await this.db
        .insert(schema.lineItems)
        .values({
          quoteVersionId,
          lineNumber,
          isNote: true,
          noteText: rest.noteText,
          internalOnly: !!rest.internalOnly,
          quantity: '0',
          dnBase: '0',
        })
        .returning();
      await this.touchVersion(quoteVersionId, editedBy);
      return lineItem;
    }

    if (!rest.manufacturerId) throw new BadRequestException('manufacturerId is required');
    const [manufacturer] = await this.db
      .select()
      .from(schema.manufacturers)
      .where(eq(schema.manufacturers.id, rest.manufacturerId));
    if (!manufacturer) throw new NotFoundException(`Manufacturer ${rest.manufacturerId} not found`);

    // Auto-populate commission/overage: this quote's Commission Structure
    // override for the manufacturer, if one's been set, else the
    // Manufacturer's own standard rate (2026-09-19) — never client-entered.
    const [override] = await this.db
      .select()
      .from(schema.quoteManufacturerCommissions)
      .where(
        and(
          eq(schema.quoteManufacturerCommissions.quoteVersionId, quoteVersionId),
          eq(schema.quoteManufacturerCommissions.manufacturerId, rest.manufacturerId),
        ),
      );
    const commissionPct = override ? override.commissionPct : manufacturer.standardCommissionPct;
    const overageSplitPct = override ? override.overageSplitPct : manufacturer.standardOverageSplitPct;

    const [lineItem] = await this.db
      .insert(schema.lineItems)
      .values({
        quoteVersionId,
        lineNumber,
        quantity: rest.quantity ?? '1',
        fixtureType: rest.fixtureType,
        manufacturerId: rest.manufacturerId,
        partNumber: rest.partNumber,
        partDescription: rest.partDescription,
        notes: rest.notes,
        dnBase: rest.dnBase ?? '0',
        commissionPct,
        overageSplitPct,
        internalOnly: !!rest.internalOnly,
      })
      .returning();
    await this.touchVersion(quoteVersionId, editedBy);
    return lineItem;
  }

  /** Bumps updatedAt/lastEditedBy on a version so the recent-quotes list reflects this change. */
  private async touchVersion(quoteVersionId: string, editedBy?: string) {
    await this.db
      .update(schema.quoteVersions)
      .set({ updatedAt: new Date(), ...(editedBy ? { lastEditedBy: editedBy } : {}) })
      .where(eq(schema.quoteVersions.id, quoteVersionId));
  }

  findAllForVersion(quoteVersionId: string) {
    return this.db
      .select()
      .from(schema.lineItems)
      .where(eq(schema.lineItems.quoteVersionId, quoteVersionId))
      .orderBy(asc(schema.lineItems.lineNumber));
  }

  async findOneWithPricing(id: string) {
    const [lineItem] = await this.db.select().from(schema.lineItems).where(eq(schema.lineItems.id, id));
    if (!lineItem) return null;
    const priceColumns = await this.db
      .select()
      .from(schema.priceColumns)
      .where(eq(schema.priceColumns.lineItemId, id));

    const dn = Number(lineItem.dnBase);
    const commissionPct = Number(lineItem.commissionPct ?? 0);
    const overageSplitPct = Number(lineItem.overageSplitPct ?? 0);

    // Commission Earned formula from Phase 1: (DN × Commission%) + ((Sell − DN) × Overage Split%)
    const columnsWithPricing = priceColumns
      .sort((a, b) => a.columnOrder - b.columnOrder)
      .map((pc) => {
        const sell = dn * Number(pc.multiplier);
        const commissionEarned = dn * commissionPct + (sell - dn) * overageSplitPct;
        return { ...pc, computedSellPrice: sell.toFixed(2), commissionEarnedAtThisColumn: commissionEarned.toFixed(2) };
      });

    return { ...lineItem, priceColumns: columnsWithPricing };
  }

  async addPriceColumn(lineItemId: string, dto: CreatePriceColumnDto) {
    const [lineItem] = await this.db.select().from(schema.lineItems).where(eq(schema.lineItems.id, lineItemId));
    if (!lineItem) throw new NotFoundException(`Line item ${lineItemId} not found`);

    const existing = await this.db
      .select()
      .from(schema.priceColumns)
      .where(eq(schema.priceColumns.lineItemId, lineItemId));
    if (existing.length >= MAX_PRICE_COLUMNS) {
      throw new BadRequestException(`Line item already has the maximum of ${MAX_PRICE_COLUMNS} price columns`);
    }

    const { editedBy, ...priceColumnFields } = dto;
    const [priceColumn] = await this.db
      .insert(schema.priceColumns)
      .values({ lineItemId, ...priceColumnFields })
      .returning();
    await this.touchVersion(lineItem.quoteVersionId, editedBy);
    return priceColumn;
  }

  /**
   * Powers the "Commission Structure" dialog — every manufacturer actually
   * used on this quote version's fixture lines, with its currently
   * effective commission/overage (an override if one's been set here, else
   * the Manufacturer's standard rate) so it can be reviewed/edited per
   * manufacturer for this quote only (2026-09-19).
   */
  async getCommissionStructure(quoteVersionId: string) {
    const items = await this.db
      .select({ manufacturerId: schema.lineItems.manufacturerId })
      .from(schema.lineItems)
      .where(and(eq(schema.lineItems.quoteVersionId, quoteVersionId), eq(schema.lineItems.isNote, false)));

    const manufacturerIds = [...new Set(items.map((i) => i.manufacturerId).filter((id): id is string => !!id))];
    if (manufacturerIds.length === 0) return [];

    const overrides = await this.db
      .select()
      .from(schema.quoteManufacturerCommissions)
      .where(eq(schema.quoteManufacturerCommissions.quoteVersionId, quoteVersionId));
    const overrideByMfr = new Map(overrides.map((o) => [o.manufacturerId, o]));

    const mfrs = await this.db.select().from(schema.manufacturers);
    const mfrById = new Map(mfrs.map((m) => [m.id, m]));

    return manufacturerIds
      .map((id) => {
        const mfr = mfrById.get(id);
        if (!mfr) return null;
        const override = overrideByMfr.get(id);
        return {
          manufacturerId: id,
          manufacturerName: mfr.name,
          standardCommissionPct: mfr.standardCommissionPct,
          standardOverageSplitPct: mfr.standardOverageSplitPct,
          commissionPct: override ? override.commissionPct : mfr.standardCommissionPct,
          overageSplitPct: override ? override.overageSplitPct : mfr.standardOverageSplitPct,
          isOverridden: !!override,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }

  /**
   * Saves this quote's commission/overage override for one manufacturer and
   * immediately re-stamps every existing line item on this version that
   * uses that manufacturer, so the values line items carry stay correct
   * without needing a live join elsewhere (2026-09-19).
   */
  async setCommissionStructure(quoteVersionId: string, dto: SetCommissionStructureDto) {
    const [version] = await this.db
      .select()
      .from(schema.quoteVersions)
      .where(eq(schema.quoteVersions.id, quoteVersionId));
    if (!version) throw new NotFoundException(`Quote version ${quoteVersionId} not found`);

    const [manufacturer] = await this.db
      .select()
      .from(schema.manufacturers)
      .where(eq(schema.manufacturers.id, dto.manufacturerId));
    if (!manufacturer) throw new NotFoundException(`Manufacturer ${dto.manufacturerId} not found`);

    const [existing] = await this.db
      .select()
      .from(schema.quoteManufacturerCommissions)
      .where(
        and(
          eq(schema.quoteManufacturerCommissions.quoteVersionId, quoteVersionId),
          eq(schema.quoteManufacturerCommissions.manufacturerId, dto.manufacturerId),
        ),
      );

    if (existing) {
      await this.db
        .update(schema.quoteManufacturerCommissions)
        .set({ commissionPct: dto.commissionPct, overageSplitPct: dto.overageSplitPct })
        .where(eq(schema.quoteManufacturerCommissions.id, existing.id));
    } else {
      await this.db.insert(schema.quoteManufacturerCommissions).values({
        quoteVersionId,
        manufacturerId: dto.manufacturerId,
        commissionPct: dto.commissionPct,
        overageSplitPct: dto.overageSplitPct,
      });
    }

    await this.db
      .update(schema.lineItems)
      .set({ commissionPct: dto.commissionPct, overageSplitPct: dto.overageSplitPct })
      .where(
        and(
          eq(schema.lineItems.quoteVersionId, quoteVersionId),
          eq(schema.lineItems.manufacturerId, dto.manufacturerId),
        ),
      );

    await this.touchVersion(quoteVersionId, dto.editedBy);
    return this.getCommissionStructure(quoteVersionId);
  }
}
