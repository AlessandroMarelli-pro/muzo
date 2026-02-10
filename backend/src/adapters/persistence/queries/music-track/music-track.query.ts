import { Injectable } from '@nestjs/common';
import {
  IMusicTrackQueries,
  RandomTrackWithStats,
} from 'src/application/ports/queries/IMusicTrackQueries';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { getCurrentUserId } from 'src/kernel/types';
import { musicTracksIncludes } from '../../includes/music-tracks-includes';
import { toDomain } from '../../repositories/music-track/music-track.mapper';

@Injectable()
export class MusicTrackQuery implements IMusicTrackQueries {
  constructor(private readonly prisma: PrismaService) {}

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
      const track = await this.prisma.musicTrack.findUnique({
        where: { id: row.trackId },
        include: musicTracksIncludes,
      });
      return {
        track: track ? toDomain(track) : null,
        likedCount: Number(row.likedCount),
        bangerCount: Number(row.bangerCount),
        dislikedCount: Number(row.dislikedCount),
        remainingCount: Number(row.remainingCount),
      };
    });
  }
}
