import { Controller, Logger, Param, Post } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { QueueService } from './queue.service';
import { ScanSessionService } from './scan-session.service';

@Controller('queue')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly prismaService: PrismaService,
    private readonly scanSessionService: ScanSessionService,
  ) {}

  /**
   * Start scanning a specific library
   */
  @Post('scan-library/:libraryId')
  async scanLibrary(
    @Param('libraryId') libraryId: string,
  ): Promise<{ message: string; sessionId: string }> {
    try {
      const library = await this.prismaService.musicLibrary.findUnique({
        where: { id: libraryId },
      });
      this.logger.log(`Scanning library: ${libraryId}`, library);

      if (!library) {
        throw new Error(`Library not found: ${libraryId}`);
      }

      const sessionId = await this.queueService.scheduleLibraryScan(
        library.id,
        library.rootPath,
        library.name,
      );

      this.logger.log(
        `Scheduled library scan for: ${library.name} with session: ${sessionId}`,
      );

      return {
        message: `Scheduled library scan for: ${library.name}`,
        sessionId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to schedule library scan for ${libraryId}:`,
        error,
      );
      throw error;
    }
  }
}
