import { Module } from '@nestjs/common';
import { ManufacturersController } from './manufacturers.controller.js';
import { ManufacturersService } from './manufacturers.service.js';

@Module({
  controllers: [ManufacturersController],
  providers: [ManufacturersService],
  exports: [ManufacturersService],
})
export class ManufacturersModule {}
