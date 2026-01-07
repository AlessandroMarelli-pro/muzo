import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  AddTrackToPlaylistDto,
  CreatePlaylistDto,
  ReorderTracksDto,
  UpdatePlaylistDto,
} from './dto/playlist.dto';

@Injectable()
export class PlaylistService {
  constructor(private readonly prisma: PrismaService) {}

  async createPlaylist(createPlaylistDto: CreatePlaylistDto) {
    return this.prisma.playlist.create({
      data: createPlaylistDto,
      include: {
        tracks: {
          include: {
            track: {
              include: {
                audioFingerprint: true,
                aiAnalysisResult: true,
                imageSearches: true,
                trackGenres: {
                  include: {
                    genre: true,
                  },
                },
                trackSubgenres: {
                  include: {
                    subgenre: true,
                  },
                },
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });
  }
  async findAllPlaylists() {
    return this.prisma.playlist.findMany({
      where: {},
      include: {
        tracks: {
          include: {
            track: {
              include: {
                audioFingerprint: true,
                aiAnalysisResult: true,
                imageSearches: true,
                trackGenres: {
                  include: {
                    genre: true,
                  },
                },
                trackSubgenres: {
                  include: {
                    subgenre: true,
                  },
                },
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlaylistWithStats() {
    const playlistsWithCalculations = await this.getPlaylistStatsQuery();
    return playlistsWithCalculations.map((playlist: any) =>
      this.mapPlaylistStatsToItem(playlist),
    );
  }

  async getPlaylistWithStatsById(playlistId: string) {
    const playlistWithCalculations =
      await this.getPlaylistStatsQuery(playlistId);

    if (playlistWithCalculations.length === 0) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    return this.mapPlaylistStatsToItem(playlistWithCalculations[0]);
  }

  private async getPlaylistStatsQuery(playlistId?: string) {
    if (playlistId) {
      return (await this.prisma.$queryRaw`
        WITH track_stats AS (
          -- First CTE: Get unique track data without duplicates
          SELECT DISTINCT
            pt.playlistId,
            pt.trackId,
            t.duration
          FROM playlist_tracks pt
          JOIN music_tracks t ON pt.trackId = t.id
          WHERE pt.playlistId = ${playlistId}
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
          WHERE pt.playlistId = ${playlistId}
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
          WHERE pt.playlistId = ${playlistId}
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
          WHERE pt.playlistId = ${playlistId}
        ),
        image_stats AS (
          -- Third CTE: Get image data
          SELECT DISTINCT
            pt.playlistId,
            pt.trackId,
            img.imagePath
          FROM playlist_tracks pt
          JOIN image_searches img ON pt.trackId = img.trackId
          WHERE pt.playlistId = ${playlistId}
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
          -- Aggregate image data separately
          SELECT 
            img.playlistId,
            GROUP_CONCAT(DISTINCT img.imagePath) as all_images
          FROM image_stats img
          GROUP BY img.playlistId
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
        WHERE p.id = ${playlistId}
      `) as any[];
    } else {
      return (await this.prisma.$queryRaw`
        WITH track_stats AS (
          -- First CTE: Get unique track data without duplicates
          SELECT DISTINCT
            pt.playlistId,
            pt.trackId,
            t.duration
          FROM playlist_tracks pt
          JOIN music_tracks t ON pt.trackId = t.id
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
        ),
        image_stats AS (
          -- Third CTE: Get image data
          SELECT DISTINCT
            pt.playlistId,
            pt.trackId,
            img.imagePath
          FROM playlist_tracks pt
          JOIN image_searches img ON pt.trackId = img.trackId
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
          -- Aggregate image data separately
          SELECT 
            img.playlistId,
            GROUP_CONCAT(DISTINCT img.imagePath) as all_images
          FROM image_stats img
          GROUP BY img.playlistId
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
        ORDER BY p.createdAt DESC
      `) as any[];
    }
  }

  private mapPlaylistStatsToItem(playlist: any) {
    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || 'No description',
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
      numberOfTracks: Number(playlist.numberOfTracks),
      totalDuration: parseFloat(playlist.totalDuration),
      bpmRange: {
        min: Number(playlist.bpmMin),
        max: Number(playlist.bpmMax),
      },
      energyRange: {
        min: Math.round(Number(playlist.energyMin) * 100) / 100,
        max: Math.round(Number(playlist.energyMax) * 100) / 100,
      },
      genresCount: Number(playlist.genresCount),
      subgenresCount: Number(playlist.subgenresCount),
      topGenres: this.getTopItems(
        this.parseCommaSeparated(playlist.allGenres),
        5,
      ),
      topSubgenres: this.getTopItems(
        this.parseCommaSeparated(playlist.allSubgenres),
        5,
      ),
      images: this.parseCommaSeparated(playlist.allImages),
    };
  }

  // Helper method to parse comma-separated string from SQLite GROUP_CONCAT
  private parseCommaSeparated(value: string | null): string[] {
    if (!value) return [];
    return value.split(',').filter((item) => item.trim() !== '');
  }

  // Helper method to get top N most frequent items
  private getTopItems(items: string[], limit: number): string[] {
    if (!items || items.length === 0) return [];

    const frequency: Record<string, number> = {};
    items.forEach((item) => {
      frequency[item] = (frequency[item] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  }

  async findPlaylistById(id: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: {
        id,
      },
      include: {
        tracks: {
          include: {
            track: {
              include: {
                audioFingerprint: true,
                aiAnalysisResult: true,
                imageSearches: true,
                trackGenres: {
                  include: {
                    genre: true,
                  },
                },
                trackSubgenres: {
                  include: {
                    subgenre: true,
                  },
                },
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${id} not found`);
    }

    return playlist;
  }

  async findPlaylistByName(name: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: {
        name,
      },
      include: {
        tracks: {
          include: {
            track: {
              include: {
                audioFingerprint: true,
                aiAnalysisResult: true,
                imageSearches: true,
                trackGenres: {
                  include: {
                    genre: true,
                  },
                },
                trackSubgenres: {
                  include: {
                    subgenre: true,
                  },
                },
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!playlist) {
      return null;
    }

    return playlist;
  }

  async updatePlaylist(id: string, updatePlaylistDto: UpdatePlaylistDto) {
    // Verify ownership or public access
    const existingPlaylist = await this.findPlaylistById(id);

    return this.prisma.playlist.update({
      where: { id },
      data: updatePlaylistDto,
      include: {
        tracks: {
          include: {
            track: {
              include: {
                audioFingerprint: true,
                aiAnalysisResult: true,
                imageSearches: true,
                trackGenres: {
                  include: {
                    genre: true,
                  },
                },
                trackSubgenres: {
                  include: {
                    subgenre: true,
                  },
                },
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  async deletePlaylist(id: string) {
    // Verify ownership or public access
    const existingPlaylist = await this.findPlaylistById(id);

    return this.prisma.playlist.delete({
      where: { id },
    });
  }

  async addTrackToPlaylist(
    playlistId: string,
    addTrackDto: AddTrackToPlaylistDto,
  ) {
    // Verify playlist access
    const playlist = await this.findPlaylistById(playlistId);

    // Check if track exists
    const track = await this.prisma.musicTrack.findUnique({
      where: { id: addTrackDto.trackId },
    });

    if (!track) {
      throw new NotFoundException(
        `Track with ID ${addTrackDto.trackId} not found`,
      );
    }

    // Check if track is already in playlist
    const existingPlaylistTrack = await this.prisma.playlistTrack.findUnique({
      where: {
        playlistId_trackId: {
          playlistId,
          trackId: addTrackDto.trackId,
        },
      },
    });

    if (existingPlaylistTrack) {
      throw new BadRequestException('Track is already in this playlist');
    }

    // Get the next position
    const lastTrack = await this.prisma.playlistTrack.findFirst({
      where: { playlistId },
      orderBy: { position: 'desc' },
    });

    const nextPosition = (lastTrack?.position ?? 0) + 1;

    return this.prisma.playlistTrack.create({
      data: {
        playlistId,
        trackId: addTrackDto.trackId,
        position: addTrackDto.position ?? nextPosition,
      },
      include: {
        track: {
          include: {
            audioFingerprint: true,
            aiAnalysisResult: true,
            imageSearches: true,
            trackGenres: {
              include: {
                genre: true,
              },
            },
            trackSubgenres: {
              include: {
                subgenre: true,
              },
            },
          },
        },
      },
    });
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string) {
    // Verify playlist access
    const playlist = await this.findPlaylistById(playlistId);

    const playlistTrack = await this.prisma.playlistTrack.findUnique({
      where: {
        playlistId_trackId: {
          playlistId,
          trackId,
        },
      },
    });

    if (!playlistTrack) {
      throw new NotFoundException('Track not found in this playlist');
    }

    // Remove the track
    await this.prisma.playlistTrack.delete({
      where: {
        playlistId_trackId: {
          playlistId,
          trackId,
        },
      },
    });

    // Reorder remaining tracks
    await this.reorderTracksAfterRemoval(playlistId, playlistTrack.position);

    return { success: true };
  }

  async reorderTracks(playlistId: string, reorderDto: ReorderTracksDto) {
    // Verify playlist access
    const playlist = await this.findPlaylistById(playlistId);

    // Update track positions
    const updatePromises = reorderDto.trackOrders.map(({ trackId, position }) =>
      this.prisma.playlistTrack.update({
        where: {
          playlistId_trackId: {
            playlistId,
            trackId,
          },
        },
        data: { position },
      }),
    );

    await Promise.all(updatePromises);

    return this.findPlaylistById(playlistId);
  }

  private async reorderTracksAfterRemoval(
    playlistId: string,
    removedPosition: number,
  ) {
    // Get all tracks with position greater than the removed position
    const tracksToReorder = await this.prisma.playlistTrack.findMany({
      where: {
        playlistId,
        position: { gt: removedPosition },
      },
      orderBy: { position: 'asc' },
    });

    // Update positions to fill the gap
    const updatePromises = tracksToReorder.map((track, index) =>
      this.prisma.playlistTrack.update({
        where: { id: track.id },
        data: { position: removedPosition + index },
      }),
    );

    await Promise.all(updatePromises);
  }

  async getPlaylistTracks(playlistId: string) {
    const playlist = await this.findPlaylistById(playlistId);
    return playlist.tracks;
  }

  async getPlaylistStats(playlistId: string) {
    const playlist = await this.findPlaylistById(playlistId);

    const totalDuration = playlist.tracks.reduce((sum, playlistTrack) => {
      return sum + (playlistTrack.track.duration || 0);
    }, 0);

    const genreCounts = playlist.tracks.reduce(
      (counts, playlistTrack) => {
        if (
          playlistTrack.track.trackGenres &&
          playlistTrack.track.trackGenres.length > 0
        ) {
          playlistTrack.track.trackGenres.forEach((tg) => {
            const genreName = tg.genre.name;
            counts[genreName] = (counts[genreName] || 0) + 1;
          });
        } else {
          counts['Unknown'] = (counts['Unknown'] || 0) + 1;
        }
        return counts;
      },
      {} as Record<string, number>,
    );

    return {
      totalTracks: playlist.tracks.length,
      totalDuration,
      genreDistribution: JSON.stringify(genreCounts),
      averageDuration:
        playlist.tracks.length > 0 ? totalDuration / playlist.tracks.length : 0,
    };
  }
}
