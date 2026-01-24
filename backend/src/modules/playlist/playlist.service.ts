import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { FilterService } from '../filter/filter.service';
import {
  AddTrackToPlaylistDto,
  CreatePlaylistDto,
  ReorderTracksDto,
  UpdatePlaylistDto,
  UpdatePlaylistSortingDto,
} from './dto/playlist.dto';

@Injectable()
export class PlaylistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filterService: FilterService,
  ) {}

  async createPlaylist(createPlaylistDto: CreatePlaylistDto) {
    const { filters, maxTracks, subgenreSelectionMode, ...playlistData } = createPlaylistDto;

    // Create the playlist first
    const playlist = await this.prisma.playlist.create({
      data: playlistData,
    });

    // If filters are provided, find and add matching tracks
    if (
      filters &&
      (filters.genres?.length ||
        filters.subgenres?.length ||
        filters.atmospheres?.length ||
        filters.libraryId?.length ||
        (filters.tempo &&
          (filters.tempo.min !== undefined || filters.tempo.max !== undefined)))
    ) {
      // Build filter criteria for FilterService
      const filterCriteria: any = {
        genres: filters.genres,
        subgenres: filters.subgenres,
        atmospheres: filters.atmospheres,
        libraryId: filters.libraryId,
        tempo:
          filters.tempo &&
          (filters.tempo.min !== undefined || filters.tempo.max !== undefined)
            ? {
                min: filters.tempo.min ?? 0,
                max: filters.tempo.max ?? 200,
              }
            : undefined,
      };

      // Build Prisma where clause using FilterService
      const where =
        await this.filterService.buildPrismaWhereClause(
          filterCriteria,
          false,
          false,
          subgenreSelectionMode || 'exact',
        );

      // Find matching tracks
      const matchingTracks = await this.prisma.musicTrack.findMany({
        where,
        take: maxTracks || 100,
        include: {
          audioFingerprint: true,
        },
        orderBy: {
          fileCreatedAt: 'desc',
        },
      });

      // Add tracks to playlist
      if (matchingTracks.length > 0) {
        await this.prisma.playlistTrack.createMany({
          data: matchingTracks.map((track, index) => ({
            playlistId: playlist.id,
            trackId: track.id,
            position: index + 1,
          })),
        });
      }
    }

    // Return the playlist with tracks
    return this.findPlaylistById(playlist.id);
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

  async getPlaylistWithStats(searchName?: string) {
    const playlistsWithCalculations = await this.getPlaylistStatsQuery({
      searchName,
    });
    return playlistsWithCalculations.map((playlist: any) =>
      this.mapPlaylistStatsToItem(playlist),
    );
  }

  async getPlaylistWithStatsById(playlistId: string) {
    const playlistWithCalculations = await this.getPlaylistStatsQuery({
      playlistId,
    });

    if (playlistWithCalculations.length === 0) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    return this.mapPlaylistStatsToItem(playlistWithCalculations[0]);
  }

  private async getPlaylistStatsQuery(options?: {
    playlistId?: string;
    searchName?: string;
  }) {
    const { playlistId, searchName } = options || {};
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
        WHERE ${searchName?.trim() ? Prisma.sql`p.name LIKE ${'%' + searchName.trim() + '%'}` : Prisma.sql`1=1`}
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
    const sorting = await this.prisma.playlistSorting.findFirst({
      where: {
        playlistId: id,
      },
    });

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
          orderBy: {
            [sorting?.sortingKey || 'position']:
              sorting?.sortingDirection || 'asc',
          },
        },
      },
    });
    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${id} not found`);
    }

    return { ...playlist, sorting };
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
        },
        sorting: true,
      } as any,
    });
    if (!playlist) {
      return null;
    }

    // Apply sorting if exists, otherwise default to position asc
    const sorting = (playlist as any).sorting;
    const sortKey = sorting?.sortingKey || 'position';
    const sortDirection = sorting?.sortingDirection || 'asc';

    // Sort tracks based on sorting configuration
    const sortedTracks = [...playlist.tracks].sort((a, b) => {
      let comparison = 0;

      if (sortKey === 'position') {
        comparison = a.position - b.position;
      } else if (sortKey === 'addedAt') {
        comparison = a.addedAt.getTime() - b.addedAt.getTime();
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return {
      ...playlist,
      tracks: sortedTracks,
    };
  }

  async updatePlaylist(id: string, updatePlaylistDto: UpdatePlaylistDto) {
    const sorting = await this.prisma.playlistSorting.findFirst({
      where: {
        playlistId: id,
      },
    });
    const playlist = await this.prisma.playlist.update({
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
          orderBy: {
            [sorting?.sortingKey || 'position']:
              sorting?.sortingDirection || 'asc',
          },
        },
      },
    });
    return { ...playlist, sorting };
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

  /**
   * Update playlist track positions
   * @param playlistId - The ID of the playlist
   * @param positions - Array of trackId and position pairs
   */
  async updatePlaylistPositions(
    playlistId: string,
    positions: Array<{ trackId: string; position: number }>,
  ) {
    // Verify playlist access
    const playlist = await this.findPlaylistById(playlistId);

    // Validate all tracks exist in playlist
    const trackIds = positions.map((p) => p.trackId);
    const existingItems = await this.prisma.playlistTrack.findMany({
      where: {
        playlistId,
        trackId: { in: trackIds },
      },
    });

    if (existingItems.length !== trackIds.length) {
      const existingTrackIds = existingItems.map((item) => item.trackId);
      const missingTrackIds = trackIds.filter(
        (id) => !existingTrackIds.includes(id),
      );
      throw new NotFoundException(
        `Tracks not found in playlist: ${missingTrackIds.join(', ')}`,
      );
    }

    // Update positions
    const updatePromises = positions.map(({ trackId, position }) =>
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

    // Return updated playlist tracks ordered by position
    const updatedPlaylist = await this.prisma.playlist.findFirst({
      where: { id: playlistId },
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

    if (!updatedPlaylist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    return updatedPlaylist.tracks;
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

    const totalDuration = playlist.tracks.reduce((sum, playlistTrack: any) => {
      return sum + (playlistTrack.track?.duration || 0);
    }, 0);

    const genreCounts = playlist.tracks.reduce(
      (counts, playlistTrack: any) => {
        if (
          playlistTrack.track?.trackGenres &&
          playlistTrack.track.trackGenres.length > 0
        ) {
          playlistTrack.track.trackGenres.forEach((tg: any) => {
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

  async exportPlaylistToM3U(playlistId: string): Promise<string> {
    const playlist = await this.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    // Start with M3U header
    let m3uContent = '#EXTM3U\n';

    // Add each track
    for (const playlistTrack of playlist.tracks) {
      const track = (playlistTrack as any).track;
      const duration = Math.floor(track?.duration || 0);
      const artist =
        track?.originalArtist ||
        track?.aiArtist ||
        track?.userArtist ||
        'Unknown Artist';
      const title =
        track?.originalTitle ||
        track?.aiTitle ||
        track?.userTitle ||
        'Unknown Title';
      const displayName = `${artist} - ${title}`;

      // Add EXTINF line with duration and display name
      m3uContent += `#EXTINF:${duration},${displayName}\n`;

      // Add file path (absolute path)
      m3uContent += `${track?.filePath || ''}\n`;
    }

    return m3uContent;
  }

  /**
   * Update or create playlist sorting configuration
   * @param playlistId - The ID of the playlist
   * @param sortingDto - The sorting configuration
   */
  async updatePlaylistSorting(
    playlistId: string,
    sortingDto: UpdatePlaylistSortingDto,
  ) {
    // Verify playlist access
    const playlist = await this.findPlaylistById(playlistId);

    // Validate sorting key
    const validSortingKeys = ['addedAt', 'position'];
    if (!validSortingKeys.includes(sortingDto.sortingKey)) {
      throw new BadRequestException(
        `Invalid sortingKey. Must be one of: ${validSortingKeys.join(', ')}`,
      );
    }

    // Validate sorting direction
    const validSortingDirections = ['asc', 'desc'];
    if (!validSortingDirections.includes(sortingDto.sortingDirection)) {
      throw new BadRequestException(
        `Invalid sortingDirection. Must be one of: ${validSortingDirections.join(', ')}`,
      );
    }

    // Upsert the sorting configuration
    const sorting = await (this.prisma as any).playlistSorting.upsert({
      where: {
        playlistId,
      },
      update: {
        sortingKey: sortingDto.sortingKey,
        sortingDirection: sortingDto.sortingDirection,
      },
      create: {
        playlistId,
        sortingKey: sortingDto.sortingKey,
        sortingDirection: sortingDto.sortingDirection,
      },
    });

    return sorting;
  }
}
