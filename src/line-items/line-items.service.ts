import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import * as schema from '../db/schema.js';
import { CreateLineItemDto } from './dto/create-line-item.dto.js';
import { CreatePriceColumnDto } from './dto/create-price-column.dto.js';

const MAX_PRICE_COLUMNS = 10;

@Injectable()
export class LineItemsService {
  constructor(@Inject(DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async createForVersion(quoteVersionId: string, dto: CreateLineItemDto) {
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

    const { editedBy, ...lineItemFields } = dto;
    const [lineItem] = await this.db
      .insert(schema.lineItems)
      .values({ quoteVersionId, ...lineItemFields })
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
    return this.db.select().from(schema.lineItems).where(eq(schema.lineItems.quoteVersionId, quoteVersionId));
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
}
