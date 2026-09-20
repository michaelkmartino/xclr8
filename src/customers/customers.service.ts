import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import * as schema from '../db/schema.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { AddGroupMemberDto } from './dto/add-group-member.dto.js';

@Injectable()
export class CustomersService {
  constructor(@Inject(DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async create(dto: CreateCustomerDto) {
    const [customer] = await this.db
      .insert(schema.customers)
      .values({ name: dto.name, type: dto.type ?? 'individual' })
      .returning();
    return customer;
  }

  findAll() {
    return this.db.select().from(schema.customers);
  }

  async findOne(id: string) {
    const [customer] = await this.db.select().from(schema.customers).where(eq(schema.customers.id, id));
    if (!customer) return null;
    if (customer.type === 'group') {
      const members = await this.db
        .select({ id: schema.customers.id, name: schema.customers.name })
        .from(schema.customerGroupMembers)
        .innerJoin(schema.customers, eq(schema.customers.id, schema.customerGroupMembers.memberCustomerId))
        .where(eq(schema.customerGroupMembers.groupId, id));
      return { ...customer, members };
    }
    return customer;
  }

  async addMember(groupId: string, dto: AddGroupMemberDto) {
    const [group] = await this.db.select().from(schema.customers).where(eq(schema.customers.id, groupId));
    if (!group) throw new NotFoundException(`Customer ${groupId} not found`);
    if (group.type !== 'group') throw new BadRequestException(`${group.name} is not a Customer Group`);

    const [member] = await this.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, dto.memberCustomerId));
    if (!member) throw new NotFoundException(`Customer ${dto.memberCustomerId} not found`);

    const [row] = await this.db
      .insert(schema.customerGroupMembers)
      .values({ groupId, memberCustomerId: dto.memberCustomerId })
      .returning();
    return row;
  }
}
