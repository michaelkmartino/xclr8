import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB } from '../db/db.module.js';
import * as schema from '../db/schema.js';

@Injectable()
export class AdminService {
  constructor(@Inject(DB) private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Wipes all Job/Quote test data — Jobs, Quotes, Quote Versions, Line
   * Items, Price Columns, per-quote Commission Structure overrides, and
   * Print Selections — while leaving Manufacturers and Customers (setup
   * data, not test data) untouched. Deletes in FK-dependency order since
   * these tables have no ON DELETE CASCADE (confirmed 2026-09-19).
   */
  async resetTestData() {
    return this.db.transaction(async (tx) => {
      const counts = {
        printSelections: (await tx.delete(schema.printSelections).returning()).length,
        priceColumns: (await tx.delete(schema.priceColumns).returning()).length,
        quoteManufacturerCommissions: (await tx.delete(schema.quoteManufacturerCommissions).returning()).length,
        lineItems: (await tx.delete(schema.lineItems).returning()).length,
        quoteVersions: (await tx.delete(schema.quoteVersions).returning()).length,
        quotes: (await tx.delete(schema.quotes).returning()).length,
        jobs: (await tx.delete(schema.jobs).returning()).length,
      };
      return counts;
    });
  }
}
