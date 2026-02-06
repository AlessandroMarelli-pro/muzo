import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { AdminMethodsService } from './admin-methods.service';

@Controller('admin-methods')
export class AdminMethodsController {
  constructor(private readonly adminMethodsService: AdminMethodsService) {}

  @Get('set-created-by-id-anonymous')
  @HttpCode(HttpStatus.OK)
  async setCreatedByIdToUserId() {
    return this.adminMethodsService.setCreatedByIdAnonymous();
  }
}
