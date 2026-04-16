import { Inject, Injectable } from '@nestjs/common';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { PRISMA_SERVICE, PrismaService } from '../infrastructure/database/prisma.service';

@Injectable()
export class AdminMethodsService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('AdminMethodsService');
  }

  async updateTrackDurationToRoundedDuration(): Promise<{
    totalTracks: number;
    updatedTracks: number;
    failedTracks: number;
    errors: Array<{ trackId: string; filePath: string; error: string }>;
  }> {
    const tracks = await this.prisma.musicTrack.findMany({
      select: {
        id: true,
        filePath: true,
        duration: true,
      },
    });
    for (const track of tracks) {
      if (track.duration) {
        await this.prisma.musicTrack.update({
          where: { id: track.id },
          data: { duration: Math.round(track.duration) },
        });
      }
    }
    return {
      totalTracks: tracks.length,
      updatedTracks: tracks.length,
      failedTracks: 0,
      errors: [],
    };
  }

  async setCreatedByIdAnonymous(): Promise<void> {
    const tables = [
      'musicTrack',
      'playlist',
      'playlistTrack',
      'playlistSorting',
      'savedFilter',
      'subgenre',
      'genre',
      'trackGenre',
      'trackSubgenre',
      'queue',
      'musicLibrary',
      'hiddenMusicTrack',
      'scanSession',
      'audioFingerprint',
      'aiAtmosphereTag',
      'trackAiAtmosphereTag',
      'thirdPartyOAuthToken',
    ];
    for (const table of tables) {
      console.log('table', table);
      const result = await (this.prisma as any)[table].updateMany({
        data: { createdById: 'V5YEbCI2EpH9poNEuflLsyG17XIImWMJ' },
      });
      console.log('result.count', result.count);
    }
  }
}
