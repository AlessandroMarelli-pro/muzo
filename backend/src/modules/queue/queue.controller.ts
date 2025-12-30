import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { QueueService } from './queue.service';

@Controller('queue')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Start scanning all libraries
   */
  @Post('scan-all-libraries')
  async scanAllLibraries(): Promise<{
    message: string;
    librariesScheduled: number;
  }> {
    try {
      const libraries = await this.prismaService.musicLibrary.findMany({
        where: { autoScan: true },
      });

      let scheduledCount = 0;
      for (const library of libraries) {
        await this.queueService.scheduleLibraryScan(
          library.id,
          library.rootPath,
          library.name,
        );
        scheduledCount++;
      }

      this.logger.log(`Scheduled ${scheduledCount} libraries for scanning`);

      return {
        message: `Scheduled ${scheduledCount} libraries for scanning`,
        librariesScheduled: scheduledCount,
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
  ): Promise<{ message: string }> {
    try {
      const library = await this.prismaService.musicLibrary.findUnique({
        where: { id: libraryId },
      });

      if (!library) {
        throw new Error(`Library not found: ${libraryId}`);
      }

      await this.queueService.scheduleLibraryScan(
        library.id,
        library.rootPath,
        library.name,
      );

      this.logger.log(`Scheduled library scan for: ${library.name}`);

      return {
        message: `Scheduled library scan for: ${library.name}`,
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
   * Update BPM for a specific track
   */
  @Post('bpm-update/:trackId')
  async updateTrackBPM(
    @Param('trackId') trackId: string,
    @Body()
    body: {} = {},
  ): Promise<{ message: string }> {
    try {
      const track = await this.prismaService.musicTrack.findUnique({
        where: { id: trackId },
        include: {
          library: {
            select: { id: true },
          },
        },
      });

      if (!track) {
        throw new Error(`Track not found: ${trackId}`);
      }

      await this.queueService.scheduleBPMUpdate(
        track.id,
        track.filePath,
        track.fileName,
        track.libraryId,
      );

      this.logger.log(`Scheduled BPM update for track: ${track.fileName}`);

      return {
        message: `Scheduled BPM update for track: ${track.fileName}`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to schedule BPM update for track ${trackId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update BPM for all tracks in a library
   */
  @Post('bpm-update-library/:libraryId')
  async updateLibraryBPM(
    @Param('libraryId') libraryId: string,
    @Body()
    body: {} = {},
  ): Promise<{ message: string; tracksScheduled: number }> {
    try {
      const library = await this.prismaService.musicLibrary.findUnique({
        where: { id: libraryId },
      });

      if (!library) {
        throw new Error(`Library not found: ${libraryId}`);
      }

      // Get all tracks in the library
      const tracks = await this.prismaService.musicTrack.findMany({
        where: { libraryId },
        select: {
          id: true,
          filePath: true,
          fileName: true,
          libraryId: true,
        },
      });

      if (tracks.length === 0) {
        this.logger.log(`No tracks found in library: ${library.name}`);
        return {
          message: `No tracks found in library: ${library.name}`,
          tracksScheduled: 0,
        };
      }

      // Schedule BPM updates for all tracks
      await this.queueService.scheduleBatchBPMUpdates(
        tracks.map((track) => ({
          trackId: track.id,
          filePath: track.filePath,
          fileName: track.fileName,
          libraryId: track.libraryId,
        })),
      );

      this.logger.log(
        `Scheduled BPM updates for ${tracks.length} tracks in library: ${library.name}`,
      );

      return {
        message: `Scheduled BPM updates for ${tracks.length} tracks in library: ${library.name}`,
        tracksScheduled: tracks.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to schedule BPM updates for library ${libraryId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update BPM for all tracks across all libraries
   */
  @Post('bpm-update-all')
  async updateAllTracksBPM(
    @Body()
    body: {} = {},
  ): Promise<{ message: string; tracksScheduled: number }> {
    try {
      // Get all tracks from all libraries
      const tracks = await this.prismaService.musicTrack.findMany({
        select: {
          id: true,
          filePath: true,
          fileName: true,
          libraryId: true,
        },
      });

      if (tracks.length === 0) {
        this.logger.log('No tracks found in any library');
        return {
          message: 'No tracks found in any library',
          tracksScheduled: 0,
        };
      }

      // Schedule BPM updates for all tracks
      await this.queueService.scheduleBatchBPMUpdates(
        tracks.map((track) => ({
          trackId: track.id,
          filePath: track.filePath,
          fileName: track.fileName,
          libraryId: track.libraryId,
        })),
      );

      this.logger.log(
        `Scheduled BPM updates for ${tracks.length} tracks across all libraries`,
      );

      return {
        message: `Scheduled BPM updates for ${tracks.length} tracks across all libraries`,
        tracksScheduled: tracks.length,
      };
    } catch (error) {
      this.logger.error(
        'Failed to schedule BPM updates for all tracks:',
        error,
      );
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
            originalArtist: null,
            originalTitle: null,
          },
        },
      );
      const filteredTracks = tracksWithNullArtist.filter(
        (track) => track.fileSize <= 100000000, // 100MB
      );
      if (filteredTracks.length === 0) {
        this.logger.log('No tracks found with null originalArtist');
        return {
          message: 'No tracks found with null originalArtist',
          tracksScheduled: 0,
        };
      }

      // Schedule audio scans for these tracks
      await this.queueService.scheduleScanForMissingData(filteredTracks);

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
