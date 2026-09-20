import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { desc, eq } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import * as schema from '../db/schema.js';
import { CreateJobDto } from './dto/create-job.dto.js';

@Injectable()
export class JobsService {
  constructor(@Inject(DB) private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Creating a Job also creates its first Quote ("Base Bid") and that
   * Quote's first Version, so there's no separate "add a bid package" step
   * for the common one-bid-package case — you land straight on a version
   * you can start entering line items into (simplified 2026-09-19, per
   * feedback that the extra click wasn't needed day-to-day). A second bid
   * package (e.g. an addendum) is still just "Add bid package" on the Job
   * page when that's actually needed.
   */
  async create(dto: CreateJobDto) {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .insert(schema.jobs)
        .values({
          name: dto.name,
          address: dto.address,
          accountName: dto.accountName,
          branchId: dto.branchId,
        })
        .returning();

      const [quote] = await tx
        .insert(schema.quotes)
        .values({ jobId: job.id, bidPackage: 'Base Bid' })
        .returning();

      await tx
        .insert(schema.quoteVersions)
        .values({ quoteId: quote.id, versionNumber: 1, label: 'Initial', isReporting: true });

      return job;
    });
  }

  async findAll() {
    return this.db.select().from(schema.jobs).orderBy(desc(schema.jobs.createdAt));
  }

  async findOne(id: string) {
    const [job] = await this.db.select().from(schema.jobs).where(eq(schema.jobs.id, id));
    return job ?? null;
  }
}
