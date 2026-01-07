import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLibraryMetrics() {
    const [
      totalTracks,
      totalListeningTime,
      genreDistribution,
      subgenreDistribution,
      artistCount,
      yearDistribution,
      formatDistribution,
      listeningStats,
      topArtists,
      topGenres,
      recentActivity,
    ] = await Promise.all([
      this.getTotalTracks(),
      this.getTotalListeningTime(),
      this.getGenreDistribution(),
      this.getSubgenreDistribution(),
      this.getArtistCount(),
      this.getYearDistribution(),
      this.getFormatDistribution(),
      this.getListeningStats(),
      this.getTopArtists(),
      this.getTopGenres(),
      this.getRecentActivity(),
    ]);

    return {
      totalTracks,
      totalListeningTime,
      genreDistribution,
      subgenreDistribution,
      artistCount,
      yearDistribution,
      formatDistribution,
      listeningStats,
      topArtists,
      topGenres,
      recentActivity,
    };
  }

  private async getTotalTracks() {
    const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM music_tracks
    `;
    return Number(result[0].count);
  }

  private async getTotalListeningTime() {
    const result = await this.prisma.$queryRaw<[{ total_seconds: bigint }]>`
      SELECT COALESCE(SUM(duration), 0) as total_seconds FROM music_tracks
    `;
    return Number(result[0].total_seconds);
  }

  private async getGenreDistribution() {
    const result = await this.prisma.trackGenre.groupBy({
      by: ['genreId'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 20,
    });

    const genreIds = result.map((r) => r.genreId);
    const genres = await this.prisma.genre.findMany({
      where: {
        id: { in: genreIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const genreMap = new Map(genres.map((g) => [g.id, g.name]));

    return result.map((row) => ({
      genre: genreMap.get(row.genreId) || 'Unknown',
      count: Number(row._count.id),
    }));
  }

  private async getSubgenreDistribution() {
    const result = await this.prisma.trackSubgenre.groupBy({
      by: ['subgenreId'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 15,
    });

    const subgenreIds = result.map((r) => r.subgenreId);
    const subgenres = await this.prisma.subgenre.findMany({
      where: {
        id: { in: subgenreIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const subgenreMap = new Map(subgenres.map((s) => [s.id, s.name]));

    return result.map((row) => ({
      subgenre: subgenreMap.get(row.subgenreId) || 'Unknown',
      count: Number(row._count.id),
    }));
  }

  private async getArtistCount() {
    const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT COALESCE(aiArtist, originalArtist)) as count 
      FROM music_tracks 
      WHERE aiArtist IS NOT NULL OR originalArtist IS NOT NULL
    `;
    return Number(result[0].count);
  }

  private async getYearDistribution() {
    const result = await this.prisma.$queryRaw<
      Array<{ year: number; count: bigint }>
    >`
      SELECT 
        originalYear,
        COUNT(*) as count
      FROM music_tracks 
      WHERE originalYear IS NOT NULL
      GROUP BY originalYear
      ORDER BY originalYear DESC
      LIMIT 30
    `;
    return result.map((row) => ({
      year: row.year,
      count: Number(row.count),
    }));
  }

  private async getFormatDistribution() {
    const result = await this.prisma.$queryRaw<
      Array<{ format: string; count: bigint }>
    >`
      SELECT 
        format,
        COUNT(*) as count
      FROM music_tracks 
      GROUP BY format
      ORDER BY count DESC
    `;
    return result.map((row) => ({
      format: row.format,
      count: Number(row.count),
    }));
  }

  private async getListeningStats() {
    const result = await this.prisma.$queryRaw<
      Array<{
        total_plays: bigint;
        total_play_time: bigint;
        avg_confidence: number;
        favorite_count: bigint;
      }>
    >`
      SELECT 
        SUM(listeningCount) as total_plays,
        SUM(listeningCount * duration) as total_play_time,
        AVG(aiConfidence) as avg_confidence,
        COUNT(CASE WHEN isFavorite = true THEN 1 END) as favorite_count
      FROM music_tracks
    `;

    const stats = result[0];
    return {
      totalPlays: Number(stats.total_plays),
      totalPlayTime: Number(stats.total_play_time),
      averageConfidence: stats.avg_confidence || 0,
      favoriteCount: Number(stats.favorite_count),
    };
  }

  private async getTopArtists() {
    const result = await this.prisma.$queryRaw<
      Array<{
        artist: string;
        track_count: bigint;
        total_duration: number;
        avg_confidence: number;
      }>
    >`
      SELECT 
        COALESCE(aiArtist, originalArtist) as artist,
        COUNT(*) as track_count,
        SUM(duration) as total_duration,
        AVG(aiConfidence) as avg_confidence
      FROM music_tracks 
      WHERE aiArtist IS NOT NULL OR originalArtist IS NOT NULL
      GROUP BY COALESCE(aiArtist, originalArtist)
      ORDER BY track_count DESC, total_duration DESC
      LIMIT 20
    `;
    return result.map((row) => ({
      artist: row.artist,
      trackCount: Number(row.track_count),
      totalDuration: row.total_duration,
      averageConfidence: row.avg_confidence || 0,
    }));
  }

  private async getTopGenres() {
    // Get genre counts
    const genreCounts = await this.prisma.trackGenre.groupBy({
      by: ['genreId'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    const genreIds = genreCounts.map((gc) => gc.genreId);
    const genres = await this.prisma.genre.findMany({
      where: {
        id: { in: genreIds },
      },
    });

    const genreMap = new Map(genres.map((g) => [g.id, g]));

    // Get average confidence and duration for tracks with these genres
    const result = await Promise.all(
      genreCounts.map(async (gc) => {
        const genre = genreMap.get(gc.genreId);
        if (!genre) return null;

        // Get tracks with this genre to calculate averages
        const tracks = await this.prisma.musicTrack.findMany({
          where: {
            trackGenres: {
              some: {
                genreId: gc.genreId,
              },
            },
          },
          select: {
            aiConfidence: true,
            duration: true,
          },
        });

        const avgConfidence =
          tracks.length > 0
            ? tracks.reduce(
                (sum, t) => sum + (t.aiConfidence || 0),
                0,
              ) / tracks.length
            : 0;
        const avgDuration =
          tracks.length > 0
            ? tracks.reduce((sum, t) => sum + t.duration, 0) / tracks.length
            : 0;

        return {
          genre: genre.name,
          trackCount: Number(gc._count.id),
          averageConfidence: avgConfidence,
          averageDuration: avgDuration,
        };
      }),
    );

    return result.filter((r) => r !== null) as Array<{
      genre: string;
      trackCount: number;
      averageConfidence: number;
      averageDuration: number;
    }>;
  }

  private async getRecentActivity() {
    const result = await this.prisma.$queryRaw<
      Array<{
        date: string;
        tracks_added: bigint;
        tracks_analyzed: bigint;
      }>
    >`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as tracks_added,
        COUNT(CASE WHEN analysisStatus = 'COMPLETED' THEN 1 END) as tracks_analyzed
      FROM music_tracks 
      WHERE createdAt >= datetime('now', '-30 days')
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
      LIMIT 30
    `;
    return result.map((row) => ({
      date: row.date,
      tracksAdded: Number(row.tracks_added),
      tracksAnalyzed: Number(row.tracks_analyzed),
    }));
  }
}
