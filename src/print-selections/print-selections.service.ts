import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, eq } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import * as schema from '../db/schema.js';
import { SetPrintSelectionDto } from './dto/set-print-selection.dto.js';

@Injectable()
export class PrintSelectionsService {
  constructor(@Inject(DB) private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * One Print Selection per (Quote Version, Customer) — setting it again
   * for the same pair just updates the chosen column, since this is always
   * an explicit, current choice (confirmed 2026-09-19), never a history.
   */
  async setSelection(quoteVersionId: string, dto: SetPrintSelectionDto) {
    const [version] = await this.db
      .select()
      .from(schema.quoteVersions)
      .where(eq(schema.quoteVersions.id, quoteVersionId));
    if (!version) throw new NotFoundException(`Quote version ${quoteVersionId} not found`);

    const [customer] = await this.db.select().from(schema.customers).where(eq(schema.customers.id, dto.customerId));
    if (!customer) throw new NotFoundException(`Customer ${dto.customerId} not found`);

    const [existing] = await this.db
      .select()
      .from(schema.printSelections)
      .where(
        and(
          eq(schema.printSelections.quoteVersionId, quoteVersionId),
          eq(schema.printSelections.customerId, dto.customerId),
        ),
      );

    let result;
    if (existing) {
      const [updated] = await this.db
        .update(schema.printSelections)
        .set({ selectedColumnOrder: dto.selectedColumnOrder })
        .where(eq(schema.printSelections.id, existing.id))
        .returning();
      result = updated;
    } else {
      const [created] = await this.db
        .insert(schema.printSelections)
        .values({ quoteVersionId, customerId: dto.customerId, selectedColumnOrder: dto.selectedColumnOrder })
        .returning();
      result = created;
    }

    await this.db
      .update(schema.quoteVersions)
      .set({ updatedAt: new Date(), ...(dto.editedBy ? { lastEditedBy: dto.editedBy } : {}) })
      .where(eq(schema.quoteVersions.id, quoteVersionId));

    return result;
  }

  async listForVersion(quoteVersionId: string) {
    return this.db
      .select({
        id: schema.printSelections.id,
        customerId: schema.printSelections.customerId,
        customerName: schema.customers.name,
        customerType: schema.customers.type,
        selectedColumnOrder: schema.printSelections.selectedColumnOrder,
      })
      .from(schema.printSelections)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.printSelections.customerId))
      .where(eq(schema.printSelections.quoteVersionId, quoteVersionId));
  }

  /**
   * Builds the actual priced, addressed quote for one customer/group's Print
   * Selection: every line item in the version, priced at that customer's
   * chosen column position. A group's selection applies to every member —
   * each gets their own separately-addressed quote at the same column,
   * matching how Cahill/SAW prints one quote per recipient (confirmed 2026-09-19).
   */
  async buildPrintableQuote(quoteVersionId: string, customerId: string) {
    const [selection] = await this.db
      .select()
      .from(schema.printSelections)
      .where(
        and(
          eq(schema.printSelections.quoteVersionId, quoteVersionId),
          eq(schema.printSelections.customerId, customerId),
        ),
      );
    if (!selection) {
      throw new NotFoundException(
        `No print selection set for customer ${customerId} on quote version ${quoteVersionId}`,
      );
    }

    const [customer] = await this.db.select().from(schema.customers).where(eq(schema.customers.id, customerId));
    let recipients: { id: string; name: string }[] = [customer];
    if (customer.type === 'group') {
      recipients = await this.db
        .select({ id: schema.customers.id, name: schema.customers.name })
        .from(schema.customerGroupMembers)
        .innerJoin(schema.customers, eq(schema.customers.id, schema.customerGroupMembers.memberCustomerId))
        .where(eq(schema.customerGroupMembers.groupId, customerId));
      if (recipients.length === 0) {
        throw new BadRequestException(`Customer Group "${customer.name}" has no members yet`);
      }
    }

    const lineItems = await this.db
      .select()
      .from(schema.lineItems)
      .where(eq(schema.lineItems.quoteVersionId, quoteVersionId))
      .orderBy(asc(schema.lineItems.lineNumber));

    const pricedLines: Array<{
      lineNumber: number;
      isNote?: boolean;
      noteText?: string | null;
      fixtureType?: string | null;
      partNumber?: string | null;
      partDescription?: string | null;
      quantity?: string;
      unitSellPrice?: string;
      extendedSellPrice?: string;
      priceColumnLabel?: string;
    }> = [];
    for (const li of lineItems) {
      // Internal-only notes never appear on a printed/sent quote; other
      // notes print as a plain text line, unpriced (confirmed 2026-09-19).
      if (li.isNote) {
        if (li.internalOnly) continue;
        pricedLines.push({ lineNumber: li.lineNumber, isNote: true, noteText: li.noteText });
        continue;
      }

      const [column] = await this.db
        .select()
        .from(schema.priceColumns)
        .where(
          and(eq(schema.priceColumns.lineItemId, li.id), eq(schema.priceColumns.columnOrder, selection.selectedColumnOrder)),
        );
      if (!column) {
        throw new BadRequestException(
          `Line ${li.lineNumber} (${li.fixtureType}) has no price column #${selection.selectedColumnOrder} set yet`,
        );
      }
      const dn = Number(li.dnBase);
      const sellUnit = dn * Number(column.multiplier);
      const quantity = Number(li.quantity);
      pricedLines.push({
        lineNumber: li.lineNumber,
        fixtureType: li.fixtureType,
        partNumber: li.partNumber,
        partDescription: li.partDescription,
        quantity: li.quantity,
        unitSellPrice: sellUnit.toFixed(2),
        extendedSellPrice: (sellUnit * quantity).toFixed(2),
        priceColumnLabel: column.columnLabel,
      });
    }

    const quoteTotal = pricedLines.reduce((sum, l) => sum + Number(l.extendedSellPrice ?? 0), 0);

    return {
      quoteVersionId,
      selectedColumnOrder: selection.selectedColumnOrder,
      recipients, // one addressed PDF per recipient, per the confirmed multi-recipient behavior
      lineItems: pricedLines,
      quoteTotal: quoteTotal.toFixed(2),
    };
  }
}
