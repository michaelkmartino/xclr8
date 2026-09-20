import { Module } from '@nestjs/common';
import { LineItemsController } from './line-items.controller.js';
import { LineItemsService } from './line-items.service.js';

@Module({
  controllers: [LineItemsController],
  providers: [LineItemsService],
})
export class LineItemsModule {}
