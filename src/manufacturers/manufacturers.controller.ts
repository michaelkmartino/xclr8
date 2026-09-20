import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ManufacturersService } from './manufacturers.service.js';
import { CreateManufacturerDto } from './dto/create-manufacturer.dto.js';
import { UpdateManufacturerDto } from './dto/update-manufacturer.dto.js';

@Controller('manufacturers')
export class ManufacturersController {
  constructor(private readonly service: ManufacturersService) {}

  @Post()
  create(@Body() dto: CreateManufacturerDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const m = await this.service.findOne(id);
    if (!m) throw new NotFoundException(`Manufacturer ${id} not found`);
    return m;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateManufacturerDto) {
    const m = await this.service.update(id, dto);
    if (!m) throw new NotFoundException(`Manufacturer ${id} not found`);
    return m;
  }
}
