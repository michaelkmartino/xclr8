import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PrintSelectionsService } from './print-selections.service.js';
import { SetPrintSelectionDto } from './dto/set-print-selection.dto.js';

@Controller()
export class PrintSelectionsController {
  constructor(private readonly service: PrintSelectionsService) {}

  @Post('versions/:versionId/print-selections')
  setSelection(@Param('versionId') versionId: string, @Body() dto: SetPrintSelectionDto) {
    return this.service.setSelection(versionId, dto);
  }

  @Get('versions/:versionId/print-selections')
  listForVersion(@Param('versionId') versionId: string) {
    return this.service.listForVersion(versionId);
  }

  @Get('versions/:versionId/print-selections/:customerId/quote')
  buildPrintableQuote(@Param('versionId') versionId: string, @Param('customerId') customerId: string) {
    return this.service.buildPrintableQuote(versionId, customerId);
  }
}
