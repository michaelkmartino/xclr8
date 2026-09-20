import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { AddGroupMemberDto } from './dto/add-group-member.dto.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const customer = await this.service.findOne(id);
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);
    return customer;
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddGroupMemberDto) {
    return this.service.addMember(id, dto);
  }
}
