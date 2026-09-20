import { Module } from '@nestjs/common';
import { PrintSelectionsController } from './print-selections.controller.js';
import { PrintSelectionsService } from './print-selections.service.js';

@Module({
  controllers: [PrintSelectionsController],
  providers: [PrintSelectionsService],
})
export class PrintSelectionsModule {}
