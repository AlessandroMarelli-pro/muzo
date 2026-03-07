import { Inject, Injectable } from '@nestjs/common';
import {
  IMusicTrackQueries,
  RandomTrackWithStats,
} from 'src/application/ports/queries/IMusicTrackQueries';
import { PRISMA_SERVICE, PrismaService } from 'src/infrastructure/database/prisma.service';
import { getCurrentUserId } from 'src/kernel/types';
import { musicTracksIncludes } from '../../includes/music-tracks-includes';
import {
  PrismaMusicTrackWithRelations,
  toDomain,
} from '../../repositories/music-track/music-track.mapper';

@Injectable()
export class MusicTrackQuery implements IMusicTrackQueries {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async getRandomTrackWithStats(): Promise<RandomTrackWithStats> {
    const currentUserId = getCurrentUserId();
    return this.prisma.$queryRaw<
      {
        likedCount: number;
        bangerCount: number;
        dislikedCount: number;
        remainingCount: number;
        trackId: string;
      }[]
    >`
     SELECT SUM(CASE WHEN isLiked = true AND isBanger = false THEN 1 ELSE 0 END) as likedCount,
        SUM(CASE WHEN isBanger = true THEN 1 ELSE 0 END) as bangerCount,
        (SELECT COUNT(*) FROM hidden_music_tracks WHERE createdById = ${currentUserId}) as dislikedCount,
        SUM(CASE WHEN isLiked = false AND isBanger = false THEN 1 ELSE 0 END) as remainingCount,
        (SELECT id FROM music_tracks WHERE createdById = ${currentUserId} ORDER BY RANDOM() LIMIT 1) as trackId
      FROM music_tracks WHERE createdById = ${currentUserId}
    `.then(async (rows) => {
      const row = rows[0];
      const track = (await this.prisma.musicTrack.findFirst({
        where: { id: row.trackId, createdById: currentUserId },
        include: musicTracksIncludes,
      })) as PrismaMusicTrackWithRelations;
      return {
        track: track ? toDomain(track) : null,
        likedCount: Number(row.likedCount) || 0,
        bangerCount: Number(row.bangerCount) || 0,
        dislikedCount: Number(row.dislikedCount) || 0,
        remainingCount: Number(row.remainingCount) || 0,
      };
    });
  }
}
