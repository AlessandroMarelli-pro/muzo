import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { AdminMethodsService } from './admin-methods.service';

@Controller('admin-methods')
export class AdminMethodsController {
  constructor(private readonly adminMethodsService: AdminMethodsService) {}

  /**
   * Updates the fileCreatedAt field for all tracks by reading the actual file modification time
   * from the filesystem. This is an admin method used to correct schema updates and populate
   * the fileCreatedAt field with real file creation timestamps.
   *
   * @returns Object containing statistics about the update operation
   */
  @Get('update-track-file-created-at')
  @HttpCode(HttpStatus.OK)
  async updateTrackFileCreatedAt() {
    return this.adminMethodsService.updateTrackFileCreatedAt();
  }
}
