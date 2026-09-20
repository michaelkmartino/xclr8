import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import * as schema from '../db/schema.js';
import { CreateManufacturerDto } from './dto/create-manufacturer.dto.js';

@Injectable()
export class ManufacturersService {
  constructor(@Inject(DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async create(dto: CreateManufacturerDto) {
    const [m] = await this.db
      .insert(schema.manufacturers)
      .values({
        name: dto.name,
        standardCommissionPct: dto.standardCommissionPct ?? '0',
        standardOverageSplitPct: dto.standardOverageSplitPct ?? '0',
      })
      .returning();
    return m;
  }

  findAll() {
    return this.db.select().from(schema.manufacturers);
  }

  async findOne(id: string) {
    const [m] = await this.db.select().from(schema.manufacturers).where(eq(schema.manufacturers.id, id));
    return m ?? null;
  }
}
