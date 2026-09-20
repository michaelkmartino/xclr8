import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { LineItemsService } from './line-items.service.js';
import { CreateLineItemDto } from './dto/create-line-item.dto.js';
import { UpdateLineItemDto } from './dto/update-line-item.dto.js';
import { CreatePriceColumnDto } from './dto/create-price-column.dto.js';
import { SetCommissionStructureDto } from './dto/set-commission-structure.dto.js';

@Controller()
export class LineItemsController {
  constructor(private readonly lineItemsService: LineItemsService) {}

  @Post('versions/:versionId/line-items')
  create(@Param('versionId') versionId: string, @Body() dto: CreateLineItemDto) {
    return this.lineItemsService.createForVersion(versionId, dto);
  }

  @Get('versions/:versionId/line-items')
  findAllForVersion(@Param('versionId') versionId: string) {
    return this.lineItemsService.findAllForVersion(versionId);
  }

  @Post('line-items/:id/insert-before')
  insertBefore(@Param('id') id: string, @Body() dto: CreateLineItemDto) {
    return this.lineItemsService.insertBefore(id, dto);
  }

  @Get('versions/:versionId/commission-structure')
  getCommissionStructure(@Param('versionId') versionId: string) {
    return this.lineItemsService.getCommissionStructure(versionId);
  }

  @Post('versions/:versionId/commission-structure')
  setCommissionStructure(@Param('versionId') versionId: string, @Body() dto: SetCommissionStructureDto) {
    return this.lineItemsService.setCommissionStructure(versionId, dto);
  }

  @Get('line-items/:id')
  async findOne(@Param('id') id: string) {
    const lineItem = await this.lineItemsService.findOneWithPricing(id);
    if (!lineItem) throw new NotFoundException(`Line item ${id} not found`);
    return lineItem;
  }

  @Get('line-items/:id/with-children')
  getWithChildren(@Param('id') id: string) {
    return this.lineItemsService.getWithChildren(id);
  }

  @Patch('line-items/:id')
  update(@Param('id') id: string, @Body() dto: UpdateLineItemDto) {
    return this.lineItemsService.update(id, dto);
  }

  @Delete('line-items/:id')
  remove(@Param('id') id: string, @Query('editedBy') editedBy?: string) {
    return this.lineItemsService.remove(id, editedBy);
  }

  @Post('line-items/:id/price-columns')
  addPriceColumn(@Param('id') id: string, @Body() dto: CreatePriceColumnDto) {
    return this.lineItemsService.addPriceColumn(id, dto);
  }
}
