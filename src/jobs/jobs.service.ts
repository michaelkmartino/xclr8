import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { desc, eq } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import * as schema from '../db/schema.js';
import { CreateJobDto } from './dto/create-job.dto.js';

@Injectable()
export class JobsService {
  constructor(@Inject(DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async create(dto: CreateJobDto) {
    const [job] = await this.db
      .insert(schema.jobs)
      .values({
        name: dto.name,
        address: dto.address,
        accountName: dto.accountName,
        branchId: dto.branchId,
      })
      .returning();
    return job;
  }

  async findAll() {
    return this.db.select().from(schema.jobs).orderBy(desc(schema.jobs.createdAt));
  }

  async findOne(id: string) {
    const [job] = await this.db.select().from(schema.jobs).where(eq(schema.jobs.id, id));
    return job ?? null;
  }
}
