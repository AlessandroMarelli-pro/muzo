import { Injectable } from '@nestjs/common';
import {
  IPlaylistStatsQuery,
  PlaylistStatsDto,
  RawPlaylistStatsRow,
} from 'src/clean-arch/application/ports/queries/IPlaylistStatsQuery';
import { PrismaService } from 'src/clean-arch/infrastructure/database/prisma.service';
import { extractModelId } from 'src/clean-arch/kernel/ids';
import { PlaylistId } from 'src/clean-arch/kernel/ids/scalars';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { handlePrismaNotFound } from '../repositories/prisma-errors';
import { mapRawRowToPlaylistStatsDto } from './playlist-stats.mapper';

@Injectable()
export class PlaylistStatsQuery implements IPlaylistStatsQuery {
  constructor(private readonly prisma: PrismaService) {}

  getPlaylistsStats(): Promise<PlaylistStatsDto[]> {
    throw new Error('Method not implemented.');
  }

  async getPlaylistStats(playlistId: PlaylistId): Promise<PlaylistStatsDto> {
    const currentUserId = getCurrentUserId();
    const playlistIdDb = extractModelId(playlistId).dbId;
    return this.prisma.$queryRaw<RawPlaylistStatsRow[]>`
        WITH track_stats AS (
          -- First CTE: Get unique track data without duplicates
          SELECT DISTINCT
            pt.playlistId,
            pt.trackId,
            t.duration
          FROM playlist_tracks pt
          JOIN music_tracks t ON pt.trackId = t.id
          WHERE pt.playlistId = ${playlistIdDb} AND pt.createdById = ${currentUserId}
        ),
        genre_stats AS (
          -- Get genres for tracks
          SELECT DISTINCT
            pt.playlistId,
            pt.trackId,
            g.name as genre_name
          FROM playlist_tracks pt
          JOIN track_genres tg ON pt.trackId = tg.trackId
          JOIN genres g ON tg.genreId = g.id
          WHERE pt.playlistId = ${playlistIdDb} AND pt.createdById = ${currentUserId}
        ),
        subgenre_stats AS (
          -- Get subgenres for tracks
          SELECT DISTINCT
            pt.playlistId,
            pt.trackId,
            s.name as subgenre_name
          FROM playlist_tracks pt
          JOIN track_subgenres ts ON pt.trackId = ts.trackId
          JOIN subgenres s ON ts.subgenreId = s.id
          WHERE pt.playlistId = ${playlistIdDb} AND pt.createdById = ${currentUserId}
        ),
        audio_stats AS (
          -- Second CTE: Get audio fingerprint data
          SELECT DISTINCT
            pt.playlistId,
            pt.trackId,
            af.tempo,
            af.energyFactor
          FROM playlist_tracks pt
          JOIN audio_fingerprints af ON pt.trackId = af.trackId
          WHERE pt.playlistId = ${playlistIdDb} AND pt.createdById = ${currentUserId}
        ),
        image_stats AS (
          -- Third CTE: Get image data
          SELECT DISTINCT
            pt.playlistId,
            pt.trackId,
            img.imagePath
          FROM playlist_tracks pt
          JOIN image_searches img ON pt.trackId = img.trackId
          WHERE pt.playlistId = ${playlistIdDb} AND pt.createdById = ${currentUserId} 
        ),
        playlist_stats AS (
          -- Aggregate track data separately to avoid duplication
          SELECT 
            ts.playlistId,
            COUNT(DISTINCT ts.trackId) as track_count,
            SUM(ts.duration) as total_duration
          FROM track_stats ts
          GROUP BY ts.playlistId
        ),
        genre_aggregated AS (
          -- Aggregate genre data separately
          SELECT 
            gs.playlistId,
            COUNT(DISTINCT gs.genre_name) as genres_count,
            GROUP_CONCAT(DISTINCT gs.genre_name) as all_genres
          FROM genre_stats gs
          GROUP BY gs.playlistId
        ),
        subgenre_aggregated AS (
          -- Aggregate subgenre data separately
          SELECT 
            ss.playlistId,
            COUNT(DISTINCT ss.subgenre_name) as subgenres_count,
            GROUP_CONCAT(DISTINCT ss.subgenre_name) as all_subgenres
          FROM subgenre_stats ss
          GROUP BY ss.playlistId
        ),
        audio_aggregated AS (
          -- Aggregate audio data separately
          SELECT 
            aud.playlistId,
            MIN(aud.tempo) as bpm_min,
            MAX(aud.tempo) as bpm_max,
            MIN(aud.energyFactor) as energy_min,
            MAX(aud.energyFactor) as energy_max
          FROM audio_stats aud
          GROUP BY aud.playlistId
        ),
        image_aggregated AS (
          -- Aggregate image data separately (limit to first 5 images)
          SELECT 
            img_filtered.playlistId,
            GROUP_CONCAT(DISTINCT img_filtered.imagePath) as all_images
          FROM (
            SELECT 
              img.playlistId,
              img.imagePath,
              ROW_NUMBER() OVER (PARTITION BY img.playlistId ORDER BY img.trackId) as rn
            FROM image_stats img
          ) img_filtered
          WHERE img_filtered.rn <= 5
          GROUP BY img_filtered.playlistId
        ),
        final_stats AS (
          -- Combine all aggregated data
          SELECT 
            ps.playlistId,
            ps.track_count,
            ps.total_duration,
            COALESCE(aa.bpm_min, 0) as bpm_min,
            COALESCE(aa.bpm_max, 0) as bpm_max,
            COALESCE(aa.energy_min, 0) as energy_min,
            COALESCE(aa.energy_max, 0) as energy_max,
            COALESCE(ga.genres_count, 0) as genres_count,
            COALESCE(sa.subgenres_count, 0) as subgenres_count,
            COALESCE(ga.all_genres, '') as all_genres,
            COALESCE(sa.all_subgenres, '') as all_subgenres,
            COALESCE(ia.all_images, '') as all_images
          FROM playlist_stats ps
          LEFT JOIN audio_aggregated aa ON ps.playlistId = aa.playlistId
          LEFT JOIN image_aggregated ia ON ps.playlistId = ia.playlistId
          LEFT JOIN genre_aggregated ga ON ps.playlistId = ga.playlistId
          LEFT JOIN subgenre_aggregated sa ON ps.playlistId = sa.playlistId
        )
        SELECT 
          p.id,
          p.name,
          p.description,
          p.createdAt,
          p.updatedAt,
          
          -- Track count (from final CTE)
          COALESCE(fs.track_count, 0) as "numberOfTracks",
          
          -- Total duration (from final CTE - truly correct now)
          COALESCE(fs.total_duration, 0) / 1.0 as "totalDuration",
          
          -- BPM range (from final CTE)
          COALESCE(fs.bpm_min, 0) / 1.0 as "bpmMin",
          COALESCE(fs.bpm_max, 0) / 1.0 as "bpmMax",
          
          -- Energy range (from final CTE)
          COALESCE(fs.energy_min, 0) / 1.0 as "energyMin",
          COALESCE(fs.energy_max, 0) / 1.0 as "energyMax",
          
          -- Genre statistics (from final CTE)
          COALESCE(fs.genres_count, 0) as "genresCount",
          COALESCE(fs.subgenres_count, 0) as "subgenresCount",
          
          -- Top genres and subgenres (from final CTE)
          fs.all_genres as "allGenres",
          fs.all_subgenres as "allSubgenres",
          
          -- Images from tracks (from final CTE)
          fs.all_images as "allImages"
          
        FROM playlists p
        LEFT JOIN final_stats fs ON p.id = fs.playlistId
        WHERE p.id = ${playlistIdDb} AND p.createdById = ${currentUserId}
      `
      .then((rows) => mapRawRowToPlaylistStatsDto(rows[0]))
      .catch((error) => {
        handlePrismaNotFound(error, `Playlist with ID ${playlistId} not found`);
      });
  }
}
