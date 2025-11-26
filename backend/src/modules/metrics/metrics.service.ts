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
    const result = await this.prisma.$queryRaw<
      Array<{ genre: string; count: bigint }>
    >`
      SELECT 
        COALESCE(aiGenre, originalGenre, 'Unknown') as genre,
        COUNT(*) as count
      FROM music_tracks 
      WHERE aiGenre IS NOT NULL OR originalGenre IS NOT NULL
      GROUP BY COALESCE(aiGenre, originalGenre)
      ORDER BY count DESC
      LIMIT 20
    `;
    return result.map((row) => ({
      genre: row.genre,
      count: Number(row.count),
    }));
  }

  private async getSubgenreDistribution() {
    const result = await this.prisma.$queryRaw<
      Array<{ subgenre: string; count: bigint }>
    >`
      SELECT 
        aiSubgenre as subgenre,
        COUNT(*) as count
      FROM music_tracks 
      WHERE aiSubgenre IS NOT NULL
      GROUP BY aiSubgenre
      ORDER BY count DESC
      LIMIT 15
    `;
    return result.map((row) => ({
      subgenre: row.subgenre,
      count: Number(row.count),
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
    const result = await this.prisma.$queryRaw<
      Array<{
        genre: string;
        track_count: bigint;
        avg_confidence: number;
        avg_duration: number;
      }>
    >`
      SELECT 
        COALESCE(aiGenre, originalGenre) as genre,
        COUNT(*) as track_count,
        AVG(aiConfidence) as avg_confidence,
        AVG(duration) as avg_duration
      FROM music_tracks 
      WHERE aiGenre IS NOT NULL OR originalGenre IS NOT NULL
      GROUP BY COALESCE(aiGenre, originalGenre)
      ORDER BY track_count DESC
      LIMIT 15
    `;
    return result.map((row) => ({
      genre: row.genre,
      trackCount: Number(row.track_count),
      averageConfidence: row.avg_confidence || 0,
      averageDuration: row.avg_duration || 0,
    }));
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
