import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma.service';

@Injectable()
export class AdminMethodsService {
  private readonly logger = new Logger(AdminMethodsService.name);

  constructor(private readonly prisma: PrismaService) {}

  updateTrackDurationToRoundedDuration(): Promise<{
    totalTracks: number;
    updatedTracks: number;
    failedTracks: number;
    errors: Array<{ trackId: string; filePath: string; error: string }>;
  }> {
    return new Promise(async (resolve, reject) => {
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
      resolve({
        totalTracks: tracks.length,
        updatedTracks: tracks.length,
        failedTracks: 0,
        errors: [],
      });
    });
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
    ];
    for (const table of tables) {
      await this.prisma[table].updateMany({
        data: { createdById: 'anonymous' },
      });
    }
  }
}
