import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { LineItemsService } from './line-items.service.js';
import { CreateLineItemDto } from './dto/create-line-item.dto.js';
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

  @Post('line-items/:id/price-columns')
  addPriceColumn(@Param('id') id: string, @Body() dto: CreatePriceColumnDto) {
    return this.lineItemsService.addPriceColumn(id, dto);
  }
}
