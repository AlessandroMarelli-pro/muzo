import { Injectable } from '@nestjs/common';
import {
  IMetricsQuery,
  MetricsDto,
} from 'src/application/ports/queries/IMetricsQuery';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { getCurrentUserId } from 'src/kernel/types/context';

@Injectable()
export class MetricsQuery implements IMetricsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<MetricsDto> {
    const [
      totalTracks,
      totalListeningTime,
      artistCount,
      listeningStats,
      topArtists,
      topGenres,
      recentActivity,
    ] = await Promise.all([
      this.getTotalTracks(),
      this.getTotalListeningTime(),
      this.getArtistCount(),
      this.getListeningStats(),
      this.getTopArtists(),
      this.getTopGenres(),
      this.getRecentActivity(),
    ]);

    return {
      totalTracks,
      totalListeningTime,
      artistCount,
      listeningStats,
      topArtists,
      topGenres,
      recentActivity,
    };
  }
  private async getTotalTracks() {
    const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM music_tracks WHERE createdById = ${getCurrentUserId()}
    `;
    return Number(result[0].count);
  }

  private async getTotalListeningTime() {
    const result = await this.prisma.$queryRaw<[{ total_seconds: bigint }]>`
      SELECT COALESCE(SUM(duration), 0) as total_seconds FROM music_tracks WHERE createdById = ${getCurrentUserId()}
    `;
    return Number(result[0].total_seconds);
  }

  private async getArtistCount() {
    const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT COALESCE(aiArtist, originalArtist)) as count 
      FROM music_tracks 
      WHERE createdById = ${getCurrentUserId()} AND (aiArtist IS NOT NULL OR originalArtist IS NOT NULL)  
    `;
    return Number(result[0].count);
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
      FROM music_tracks WHERE createdById = ${getCurrentUserId()}
    `;

    const stats = result[0];
    return {
      totalPlays: Number(stats.total_plays),
      totalPlayTime: Number(stats.total_play_time),
      favoriteCount: Number(stats.favorite_count),
    };
  }

  private async getTopArtists() {
    const result = await this.prisma.$queryRaw<
      Array<{
        artist: string;
        track_count: bigint;
        total_duration: number;
      }>
    >`
      SELECT 
        COALESCE(aiArtist, originalArtist) as artist,
        COUNT(*) as track_count,
        SUM(duration) as total_duration,
        AVG(aiConfidence) as avg_confidence
      FROM music_tracks 
      WHERE createdById = ${getCurrentUserId()} AND (aiArtist IS NOT NULL OR originalArtist IS NOT NULL)
      GROUP BY COALESCE(aiArtist, originalArtist)
      ORDER BY track_count DESC, total_duration DESC
      LIMIT 20
    `;
    return result.map((row) => ({
      artist: row.artist,
      trackCount: Number(row.track_count),
      totalDuration: row.total_duration,
    }));
  }

  private async getTopGenres() {
    return this.prisma.$queryRaw<
      Array<{ genreId: string; count: bigint; name: string }>
    >`
      SELECT genreId, genres.name, COUNT(*) as count FROM track_genres JOIN genres ON track_genres.genreId = genres.id WHERE track_genres.createdById = ${getCurrentUserId()} GROUP BY genreId ORDER BY count DESC LIMIT 10
    `.then((rows) =>
      rows.map((row) => ({
        genre: row.name,
        trackCount: Number(row.count),
      })),
    );
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
      WHERE createdById = ${getCurrentUserId()} AND createdAt >= datetime('now', '-30 days')
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
