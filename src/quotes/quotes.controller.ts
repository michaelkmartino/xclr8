import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { QuotesService } from './quotes.service.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { CreateVersionDto } from './dto/create-version.dto.js';
import { LockDto } from './dto/lock.dto.js';

@Controller()
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get('quote-versions/recent')
  findRecentVersions() {
    return this.quotesService.findRecentVersions();
  }

  @Post('jobs/:jobId/quotes')
  createForJob(@Param('jobId') jobId: string, @Body() dto: CreateQuoteDto) {
    return this.quotesService.createForJob(jobId, dto);
  }

  @Get('jobs/:jobId/quotes')
  findAllForJob(@Param('jobId') jobId: string) {
    return this.quotesService.findAllForJob(jobId);
  }

  @Get('quotes/:id')
  async findOne(@Param('id') id: string) {
    const quote = await this.quotesService.findOne(id);
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    return quote;
  }

  @Post('quotes/:id/versions')
  createVersion(@Param('id') id: string, @Body() dto: CreateVersionDto) {
    return this.quotesService.createVersion(id, dto);
  }

  @Post('quotes/:id/versions/:versionId/set-reporting')
  setReporting(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.quotesService.setReporting(id, versionId);
  }

  @Post('versions/:versionId/lock')
  acquireLock(@Param('versionId') versionId: string, @Body() dto: LockDto) {
    return this.quotesService.acquireLock(versionId, dto);
  }

  @Post('versions/:versionId/unlock')
  releaseLock(@Param('versionId') versionId: string, @Body() dto: LockDto) {
    return this.quotesService.releaseLock(versionId, dto);
  }

  @Post('versions/:versionId/force-unlock')
  forceUnlock(@Param('versionId') versionId: string, @Body() dto: LockDto) {
    return this.quotesService.forceUnlock(versionId, dto);
  }
}
