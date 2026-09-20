import { Controller, Post } from '@nestjs/common';
import { AdminService } from './admin.service.js';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('reset-test-data')
  resetTestData() {
    return this.adminService.resetTestData();
  }
}
