import {
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { QueueService } from './queue.service';
import { ScanSessionService } from './scan-session.service';

@Controller('queue')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly prismaService: PrismaService,
    private readonly scanSessionService: ScanSessionService
  ) { }

  /**
   * Start scanning all libraries
   */
  @Post('scan-all-libraries')
  async scanAllLibraries(): Promise<{
    message: string;
    librariesScheduled: number;
    sessionIds: string[];
  }> {
    try {
      const libraries = await this.prismaService.musicLibrary.findMany({
        where: { autoScan: true },
      });

      let scheduledCount = 0;
      const sessionIds: string[] = [];
      for (const library of libraries) {
        const sessionId = await this.queueService.scheduleLibraryScan(
          library.id,
          library.rootPath,
          library.name,
        );
        sessionIds.push(sessionId);
        scheduledCount++;
      }

      this.logger.log(`Scheduled ${scheduledCount} libraries for scanning`);

      return {
        message: `Scheduled ${scheduledCount} libraries for scanning`,
        librariesScheduled: scheduledCount,
        sessionIds,
      };
    } catch (error) {
      this.logger.error('Failed to schedule library scans:', error);
      throw error;
    }
  }

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

      this.logger.log(`Scheduled library scan for: ${library.name} with session: ${sessionId}`);

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

  /**
   * Get queue statistics
   */
  @Get('stats')
  async getQueueStats() {
    try {
      return await this.queueService.getQueueStats();
    } catch (error) {
      this.logger.error('Failed to get queue stats:', error);
      throw error;
    }
  }

  /**
   * Clear all queues
   */
  @Delete('clear')
  async clearAllQueues(): Promise<{ message: string }> {
    try {
      await this.queueService.clearAllQueues();
      return { message: 'All queues cleared successfully' };
    } catch (error) {
      this.logger.error('Failed to clear queues:', error);
      throw error;
    }
  }

  /**
   * Pause all queues
   */
  @Post('pause')
  async pauseAllQueues(): Promise<{ message: string }> {
    try {
      await this.queueService.pauseAllQueues();
      return { message: 'All queues paused successfully' };
    } catch (error) {
      this.logger.error('Failed to pause queues:', error);
      throw error;
    }
  }

  /**
   * Resume all queues
   */
  @Post('resume')
  async resumeAllQueues(): Promise<{ message: string }> {
    try {
      await this.queueService.resumeAllQueues();
      return { message: 'All queues resumed successfully' };
    } catch (error) {
      this.logger.error('Failed to resume queues:', error);
      throw error;
    }
  }





  /**
   * Trigger audio scan for tracks with null originalArtist
   */
  @Get('scan-null-artist-tracks')
  async scanNullArtistTracks(): Promise<{
    message: string;
    tracksScheduled: number;
  }> {
    try {
      // Find all tracks with null originalArtist
      const tracksWithNullArtist = await this.prismaService.musicTrack.findMany(
        {
          where: {
            libraryId: 'a8b6b258-4789-4db7-a14d-27ad2d37c00b',
            analysisCompletedAt: {
              lte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 1 days ago
            }
            // libraryId: 'f1119048-c2c7-41e2-a273-f4a8b3a4b99e'
          },

        },
      );
      const filteredTracks = tracksWithNullArtist.filter(
        (track) => track.fileSize <= 100000000, // 100MB
      );
      console.log('filteredTracks', filteredTracks.length);
      if (filteredTracks.length >= 0) {
        this.logger.log('No tracks found with null originalArtist');
        return {
          message: 'No tracks found with null originalArtist',
          tracksScheduled: 0,
        };
      }
      const groupByLibrary = filteredTracks.reduce((acc, track) => {
        acc[track.libraryId] = [...(acc[track.libraryId] || []), track];
        return acc;
      }, {});
      for (const libraryId in groupByLibrary) {

        // Create scan session
        await this.scanSessionService.createSession(libraryId);

        await this.queueService.scheduleBulkBatchAudioScans(groupByLibrary[libraryId], false, true, libraryId);
      }
      this.logger.log(
        `Scheduled audio scans for ${tracksWithNullArtist.length} tracks with null originalArtist`,
      );

      return {
        message: `Scheduled audio scans for ${tracksWithNullArtist.length} tracks with null originalArtist`,
        tracksScheduled: tracksWithNullArtist.length,
      };
    } catch (error) {
      this.logger.error(
        'Failed to schedule audio scans for null artist tracks:',
        error,
      );
      throw error;
    }
  }

  @Get('scan-all-missing-images')
  async scanAllMissingImages(): Promise<{
    message: string;
    imagesScheduled: number;
  }> {
    const missingImagesTracks = await this.prismaService.musicTrack.findMany({
      where: {
        imageSearches: {
          none: {},
        },
        createdAt: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 30 days ago
        },
      },
      select: {
        id: true,
        filePath: true,
        libraryId: true,
        fileName: true,
        fileSize: true,
      },
    });
    const numberOfImages = missingImagesTracks.length;
    await this.queueService.scheduleScanForMissingData(
      missingImagesTracks,
      false,
    );

    return {
      message: `Scheduled ${numberOfImages} images for scanning`,
      imagesScheduled: numberOfImages,
    };
  }
}
