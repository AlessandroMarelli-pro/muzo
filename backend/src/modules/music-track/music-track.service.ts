import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnalysisStatus } from '@prisma/client';
import * as fs from 'fs';
import { MusicTrackWithRelations } from '../../models/index';
import {
  CreateMusicTrackDto,
  MusicTrack,
  MusicTrackByCategories,
  MusicTrackQueryOptions,
  MusicTrackStats,
  UpdateMusicTrackDto,
} from '../../models/music-track.model';
import { PrismaService } from '../../shared/services/prisma.service';
import { FilterService } from '../filter/filter.service';
import { PlaylistService } from '../playlist/playlist.service';
import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  RecommendationService,
  ZERO_RECOMMENDATION_WEIGHTS,
} from '../recommendation/services/recommendation.service';

@Injectable()
export class MusicTrackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playlistService: PlaylistService,
    private readonly filterService: FilterService,
    private readonly recommendationService: RecommendationService,
  ) {}

  async create(createDto: CreateMusicTrackDto): Promise<MusicTrack> {
    // Validate library exists
    const library = await this.prisma.musicLibrary.findUnique({
      where: { id: createDto.libraryId },
    });

    if (!library) {
      throw new NotFoundException(
        `Music library with ID ${createDto.libraryId} not found`,
      );
    }

    // Check if track with same file path already exists
    const existingTrack = await this.prisma.musicTrack.findUnique({
      where: { filePath: createDto.filePath },
    });

    if (existingTrack) {
      throw new BadRequestException('Track with this file path already exists');
    }

    // Validate file exists
    if (!fs.existsSync(createDto.filePath)) {
      throw new BadRequestException(
        'File does not exist at the specified path',
      );
    }

    // Validate audio format
    const supportedFormats = library.supportedFormats
      .split(',')
      .map((f) => f.trim().toUpperCase());
    if (!supportedFormats.includes(createDto.format.toUpperCase())) {
      throw new BadRequestException(
        `Unsupported audio format: ${createDto.format}`,
      );
    }

    // Validate file size if library has max file size limit
    if (
      library.maxFileSize &&
      createDto.fileSize > library.maxFileSize * 1024 * 1024
    ) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${library.maxFileSize}MB`,
      );
    }

    // Parse originalYear to support both YYYY and YYYYMMDD formats
    let parsedOriginalYear: number | null = null;
    if (createDto.originalYear) {
      const yearStr = createDto.originalYear.toString();
      if (/^\d{8}$/.test(yearStr)) {
        // Format: YYYYMMDD
        parsedOriginalYear = parseInt(yearStr.substring(0, 4), 10);
      } else if (/^\d{4}$/.test(yearStr)) {
        // Format: YYYY
        parsedOriginalYear = parseInt(yearStr, 10);
      } else {
        // Fallback: try to parse as number
        parsedOriginalYear = parseInt(yearStr, 10) || null;
      }
    }

    const track = await this.prisma.musicTrack.create({
      data: {
        filePath: createDto.filePath,
        fileName: createDto.fileName,
        fileSize: createDto.fileSize,
        duration: createDto.duration,
        format: createDto.format,
        bitrate: createDto.bitrate,
        sampleRate: createDto.sampleRate,
        originalTitle: createDto.originalTitle,
        originalArtist: createDto.originalArtist,
        originalAlbum: createDto.originalAlbum,
        originalYear: parsedOriginalYear,
        analysisStatus: AnalysisStatus.PENDING,
        libraryId: createDto.libraryId,
      },
    });

    // Update library track counts
    await this.updateLibraryTrackCounts(createDto.libraryId, 'increment');

    return track;
  }

  async findAll(
    options: MusicTrackQueryOptions = {},
  ): Promise<MusicTrackWithRelations[]> {
    const {
      libraryId,
      analysisStatus,
      format,
      limit = 250,
      offset = 0,
      orderBy = 'aiConfidence',
      orderDirection = 'asc',
      isFavorite,
    } = options;
    let where: any = {};

    const filter = this.filterService.getCurrentFilter();

    if (filter) {
      where = await this.filterService.buildPrismaWhereClause(filter);
    }

    // Build Prisma where clause

    if (libraryId) where.libraryId = libraryId;
    if (analysisStatus) where.analysisStatus = analysisStatus;
    if (format) where.format = format;
    if (isFavorite || isFavorite === false) where.isFavorite = isFavorite;

    const tracks = await this.prisma.musicTrack.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { [orderBy]: orderDirection },
      include: {
        imageSearches: true,
        audioFingerprint: true,
        library: true,
        aiAnalysisResult: true,
        editorSessions: true,
        playbackSessions: true,
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
    });
    return tracks;
  }

  async findAllPaginated(options: MusicTrackQueryOptions = {}): Promise<{
    tracks: MusicTrackWithRelations[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      libraryId,
      analysisStatus,
      format,
      limit = 50,
      offset = 0,
      orderBy = 'aiConfidence',
      orderDirection = 'asc',
      isFavorite,
    } = options;
    let where: any = {};

    const filter = this.filterService.getCurrentFilter();
    if (filter) {
      where = this.filterService.buildPrismaWhereClause(filter);
    }

    // Build Prisma where clause
    if (libraryId) where.libraryId = libraryId;
    if (analysisStatus) where.analysisStatus = analysisStatus;
    if (format) where.format = format;
    if (isFavorite || isFavorite === false) where.isFavorite = isFavorite;

    // Get total count for pagination
    const total = await this.prisma.musicTrack.count({
      where,
    });

    // Calculate current page
    const currentPage = Math.floor(offset / limit) + 1;

    // Handle sorting by audio fingerprint fields
    let orderByClause: any;
    const audioFingerprintFields = [
      'tempo',
      'key',
      'energy',
      'valence',
      'arousal',
      'danceability',
      'acousticness',
      'instrumentalness',
      'speechiness',
    ];

    const changedNames = {
      lastScannedAt: 'analysisCompletedAt',
      danceabilityFeeling: 'danceability',
      arousalMood: 'arousal',
      valenceMood: 'valence',
    };
    const orderByProp = changedNames[orderBy] || orderBy;
    if (audioFingerprintFields.includes(orderByProp)) {
      orderByClause = {
        audioFingerprint: {
          [orderByProp]: orderDirection,
        },
      };
    } else {
      orderByClause = { [orderByProp]: orderDirection };
    }

    const tracks = await this.prisma.musicTrack.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: orderByClause,
      include: {
        library: {
          select: {
            id: true,
            name: true,
          },
        },
        imageSearches: true,
        audioFingerprint: true,
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
    });

    return {
      tracks: tracks as MusicTrackWithRelations[],
      total,
      page: currentPage,
      limit,
    };
  }

  async findAllByCategories(
    options: MusicTrackQueryOptions & {
      category?: 'genre' | 'subgenre';
      genre?: string;
    },
  ): Promise<MusicTrackByCategories[]> {
    const {
      libraryId,
      analysisStatus,
      format,
      limit = 25,
      offset = 0,
      orderBy = 'aiConfidence',
      orderDirection = 'desc',
      category = 'genre',
      genre,
    } = options;

    let where: any = {};

    if (libraryId) where.libraryId = libraryId;
    if (analysisStatus) where.analysisStatus = analysisStatus;
    if (format) where.format = format;

    const filter = this.filterService.getCurrentFilter();
    if (filter) {
      where = await this.filterService.buildPrismaWhereClause(
        filter,
        true,
        true,
      );
    }

    const result: {
      category: 'genre' | 'subgenre';
      name: string;
      tracks: MusicTrack[];
      trackCount: number;
    }[] = [];

    if (category === 'genre') {
      // Get all genres with their track counts
      const genres = await this.prisma.genre.findMany({
        include: {
          trackGenres: {
            where: {
              track: where,
            },
            include: {
              track: true,
            },
          },
        },
      });

      for (const genreItem of genres) {
        if (genreItem.trackGenres.length === 0) continue;
        if (genre && genreItem.name !== genre) continue;

        const trackIds = genreItem.trackGenres.map((tg) => tg.trackId);
        const tracks = await this.prisma.musicTrack.findMany({
          where: {
            ...where,
            id: { in: trackIds },
          },
          take: limit,
          skip: offset,
          orderBy: { [orderBy]: orderDirection },
          include: {
            imageSearches: true,
            audioFingerprint: true,
            trackGenres: {
              include: { genre: true },
            },
            trackSubgenres: {
              include: { subgenre: true },
            },
          },
        });

        result.push({
          category: 'genre',
          name: genreItem.name,
          tracks,
          trackCount: genreItem.trackGenres.length,
        });
      }
    } else {
      // Get all subgenres with their track counts
      const subgenres = await this.prisma.subgenre.findMany({
        include: {
          trackSubgenres: {
            where: {
              track: where,
            },
            include: {
              track: true,
            },
          },
        },
      });

      for (const subgenre of subgenres) {
        if (subgenre.trackSubgenres.length === 0) continue;

        const trackIds = subgenre.trackSubgenres.map((ts) => ts.trackId);
        const tracks = await this.prisma.musicTrack.findMany({
          where: {
            ...where,
            id: { in: trackIds },
          },
          take: limit,
          skip: offset,
          orderBy: { [orderBy]: orderDirection },
          include: {
            imageSearches: true,
            audioFingerprint: true,
            trackGenres: {
              include: { genre: true },
            },
            trackSubgenres: {
              include: { subgenre: true },
            },
          },
        });

        result.push({
          category: 'subgenre',
          name: subgenre.name,
          tracks,
          trackCount: subgenre.trackSubgenres.length,
        });
      }
    }

    // Sort by track count descending
    return result.sort((a, b) => b.trackCount - a.trackCount);
  }

  async getCategoriesSummary(options: MusicTrackQueryOptions = {}): Promise<
    {
      category: 'genre' | 'subgenre';
      name: string;
      trackCount: number;
    }[]
  > {
    const { libraryId, analysisStatus, format } = options;
    let where: any = {};

    const filter = this.filterService.getCurrentFilter();

    if (filter) {
      where = await this.filterService.buildPrismaWhereClause(filter);
    }
    if (libraryId) where.libraryId = libraryId;
    if (analysisStatus) where.analysisStatus = analysisStatus;
    if (format) where.format = format;

    const result: {
      category: 'genre' | 'subgenre';
      name: string;
      trackCount: number;
    }[] = [];

    // Get genre groups with counts
    const genres = await this.prisma.genre.findMany({
      include: {
        _count: {
          select: {
            trackGenres: {
              where: {
                track: where,
              },
            },
          },
        },
      },
      orderBy: {
        trackGenres: {
          _count: 'desc',
        },
      },
    });

    // Get subgenre groups with counts
    const subgenres = await this.prisma.subgenre.findMany({
      include: {
        _count: {
          select: {
            trackSubgenres: {
              where: {
                track: where,
              },
            },
          },
        },
      },
      orderBy: {
        trackSubgenres: {
          _count: 'desc',
        },
      },
    });

    // Add genre groups
    for (const genre of genres) {
      if (genre._count.trackGenres > 0) {
        result.push({
          category: 'genre',
          name: genre.name,
          trackCount: genre._count.trackGenres,
        });
      }
    }

    // Add subgenre groups
    for (const subgenre of subgenres) {
      if (subgenre._count.trackSubgenres > 0) {
        result.push({
          category: 'subgenre',
          name: subgenre.name,
          trackCount: subgenre._count.trackSubgenres,
        });
      }
    }

    return result;
  }

  async findOne(id: string): Promise<MusicTrackWithRelations> {
    const track = await this.prisma.musicTrack.findUnique({
      where: { id },
      include: {
        library: true,
        audioFingerprint: true,
        aiAnalysisResult: true,
        editorSessions: true,
        playbackSessions: true,
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
    });

    if (!track) {
      throw new NotFoundException(`Music track with ID ${id} not found`);
    }

    return track as MusicTrackWithRelations;
  }

  async findOneWithAllRelations(id: string): Promise<MusicTrackWithRelations> {
    const track = await this.prisma.musicTrack.findUnique({
      where: { id },
      include: {
        library: true,
        audioFingerprint: true,
        aiAnalysisResult: true,
        editorSessions: true,
        playbackSessions: false,
        imageSearches: false,
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
    });

    if (!track) {
      throw new NotFoundException(`Music track with ID ${id} not found`);
    }

    return track;
  }
  async update(
    id: string,
    updateDto: UpdateMusicTrackDto,
  ): Promise<MusicTrack> {
    const existingTrack = await this.prisma.musicTrack.findUnique({
      where: { id },
    });

    if (!existingTrack) {
      throw new NotFoundException(`Music track with ID ${id} not found`);
    }

    // Validate analysis status transitions
    if (
      updateDto.analysisStatus &&
      existingTrack.analysisStatus !== updateDto.analysisStatus
    ) {
      if (
        !this.isValidStatusTransition(
          existingTrack.analysisStatus,
          updateDto.analysisStatus,
        )
      ) {
        throw new BadRequestException(
          `Invalid status transition from ${existingTrack.analysisStatus} to ${updateDto.analysisStatus}`,
        );
      }
    }

    const updateData: any = { ...updateDto };

    // Set timestamps for analysis status changes
    if (updateDto.analysisStatus === AnalysisStatus.PROCESSING) {
      updateData.analysisStartedAt = new Date();
    } else if (
      updateDto.analysisStatus === AnalysisStatus.COMPLETED ||
      updateDto.analysisStatus === AnalysisStatus.FAILED
    ) {
      updateData.analysisCompletedAt = new Date();
    }

    // Convert userTags array to JSON string if provided
    if (updateDto.userTags) {
      updateData.userTags = JSON.stringify(updateDto.userTags);
    }

    // Handle genre and subgenre updates
    const { genreIds, subgenreIds, ...restUpdateData } = updateData;

    const track = await this.prisma.musicTrack.update({
      where: { id },
      data: restUpdateData,
    });

    // Update genres if provided
    if (genreIds !== undefined) {
      // Delete existing genre associations
      await this.prisma.trackGenre.deleteMany({
        where: { trackId: id },
      });

      // Create new genre associations
      if (genreIds.length > 0) {
        // Get or create genres
        const genres = await Promise.all(
          genreIds.map(async (genreId: string) => {
            // Check if genre exists, if not create it
            let genre = await this.prisma.genre.findUnique({
              where: { id: genreId },
            });

            if (!genre) {
              // If genreId is actually a name, find or create by name (lowercased for uniqueness)
              const normalizedName = genreId.trim().toLowerCase();
              genre = await this.prisma.genre.findUnique({
                where: { name: normalizedName },
              });

              if (!genre) {
                genre = await this.prisma.genre.create({
                  data: { name: normalizedName },
                });
              }
            }

            return genre;
          }),
        );

        // Create track-genre associations
        await Promise.all(
          genres.map((genre) =>
            this.prisma.trackGenre.create({
              data: {
                trackId: id,
                genreId: genre.id,
              },
            }),
          ),
        );
      }
    }

    // Update subgenres if provided
    if (subgenreIds !== undefined) {
      // Delete existing subgenre associations
      await this.prisma.trackSubgenre.deleteMany({
        where: { trackId: id },
      });

      // Create new subgenre associations
      if (subgenreIds.length > 0) {
        // Get or create subgenres
        const subgenres = await Promise.all(
          subgenreIds.map(async (subgenreId: string) => {
            // Check if subgenre exists, if not create it
            let subgenre = await this.prisma.subgenre.findUnique({
              where: { id: subgenreId },
            });

            if (!subgenre) {
              // If subgenreId is actually a name, find or create by name (lowercased for uniqueness)
              const normalizedName = subgenreId.trim().toLowerCase();
              subgenre = await this.prisma.subgenre.findUnique({
                where: { name: normalizedName },
              });

              if (!subgenre) {
                subgenre = await this.prisma.subgenre.create({
                  data: { name: normalizedName },
                });
              }
            }

            return subgenre;
          }),
        );

        // Create track-subgenre associations
        await Promise.all(
          subgenres.map((subgenre) =>
            this.prisma.trackSubgenre.create({
              data: {
                trackId: id,
                subgenreId: subgenre.id,
              },
            }),
          ),
        );
      }
    }

    return track;
  }

  async remove(id: string): Promise<void> {
    const existingTrack = await this.prisma.musicTrack.findUnique({
      where: { id },
    });

    if (!existingTrack) {
      throw new NotFoundException(`Music track with ID ${id} not found`);
    }

    await this.prisma.musicTrack.delete({
      where: { id },
    });

    // Update library track counts
    await this.updateLibraryTrackCounts(existingTrack.libraryId, 'decrement');
  }

  async getStats(libraryId?: string): Promise<MusicTrackStats> {
    const where = libraryId ? { libraryId } : {};
    const tracks = await this.prisma.musicTrack.findMany({
      where,
      select: {
        duration: true,
        fileSize: true,
        format: true,
        analysisStatus: true,
      },
    });

    const totalTracks = tracks.length;
    const totalDuration = tracks.reduce(
      (sum, track) => sum + track.duration,
      0,
    );
    const averageDuration = totalTracks > 0 ? totalDuration / totalTracks : 0;
    const totalFileSize = tracks.reduce(
      (sum, track) => sum + track.fileSize,
      0,
    );
    const averageFileSize = totalTracks > 0 ? totalFileSize / totalTracks : 0;

    // Format distribution
    const formatDistribution = tracks.reduce(
      (acc, track) => {
        acc[track.format] = (acc[track.format] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Analysis status distribution
    const analysisStatusDistribution = tracks.reduce(
      (acc, track) => {
        acc[track.analysisStatus] = (acc[track.analysisStatus] || 0) + 1;
        return acc;
      },
      {} as Record<AnalysisStatus, number>,
    );

    return {
      totalTracks,
      totalDuration,
      averageDuration,
      totalFileSize,
      averageFileSize,
      formatDistribution,
      analysisStatusDistribution,
    };
  }

  async incrementListeningCount(id: string): Promise<MusicTrack> {
    const track = await this.prisma.musicTrack.findUnique({
      where: { id },
    });

    if (!track) {
      throw new NotFoundException(`Music track with ID ${id} not found`);
    }

    return this.prisma.musicTrack.update({
      where: { id },
      data: {
        listeningCount: track.listeningCount + 1,
        lastPlayedAt: new Date(),
      },
    });
  }

  async toggleFavorite(id: string): Promise<MusicTrack> {
    const track = await this.prisma.musicTrack.findUnique({
      where: { id },
    });

    if (!track) {
      throw new NotFoundException(`Music track with ID ${id} not found`);
    }

    const updatedTrack = await this.prisma.musicTrack.update({
      where: { id },
      data: {
        isFavorite: !track.isFavorite,
      },
    });

    let favPlaylist =
      await this.playlistService.findPlaylistByName('favorites');
    if (!favPlaylist) {
      favPlaylist = await this.playlistService.createPlaylist({
        name: 'favorites',
        isPublic: true,
        userId: 'system',
        description: 'Favorites playlist',
      });
    }
    if (updatedTrack.isFavorite) {
      await this.playlistService.addTrackToPlaylist(favPlaylist.id, {
        trackId: id,
      });
    } else {
      await this.playlistService.removeTrackFromPlaylist(favPlaylist.id, id);
    }

    return updatedTrack;
  }

  async findByFilePath(filePath: string): Promise<MusicTrack | null> {
    return this.prisma.musicTrack.findUnique({
      where: { filePath },
    });
  }

  async findPendingAnalysis(limit: number = 100): Promise<MusicTrack[]> {
    return this.prisma.musicTrack.findMany({
      where: { analysisStatus: AnalysisStatus.PENDING },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  private isValidStatusTransition(
    currentStatus: AnalysisStatus,
    newStatus: AnalysisStatus,
  ): boolean {
    const validTransitions: Record<AnalysisStatus, AnalysisStatus[]> = {
      [AnalysisStatus.PENDING]: [AnalysisStatus.PROCESSING],
      [AnalysisStatus.PROCESSING]: [
        AnalysisStatus.COMPLETED,
        AnalysisStatus.FAILED,
      ],
      [AnalysisStatus.COMPLETED]: [AnalysisStatus.PENDING], // Allow re-analysis
      [AnalysisStatus.FAILED]: [AnalysisStatus.PENDING], // Allow retry
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  private async updateLibraryTrackCounts(
    libraryId: string,
    operation: 'increment' | 'decrement',
  ): Promise<void> {
    const library = await this.prisma.musicLibrary.findUnique({
      where: { id: libraryId },
    });

    if (!library) return;

    const tracks = await this.prisma.musicTrack.findMany({
      where: { libraryId },
      select: { analysisStatus: true },
    });

    const totalTracks = tracks.length;
    const analyzedTracks = tracks.filter(
      (t) => t.analysisStatus === AnalysisStatus.COMPLETED,
    ).length;
    const pendingTracks = tracks.filter(
      (t) => t.analysisStatus === AnalysisStatus.PENDING,
    ).length;
    const failedTracks = tracks.filter(
      (t) => t.analysisStatus === AnalysisStatus.FAILED,
    ).length;

    await this.prisma.musicLibrary.update({
      where: { id: libraryId },
      data: {
        totalTracks,
        analyzedTracks,
        pendingTracks,
        failedTracks,
      },
    });
  }

  async getRandomTrack(): Promise<MusicTrack> {
    const tracksCount = await this.prisma.musicTrack.count({
      where: {},
    });
    const skip = Math.floor(Math.random() * tracksCount);
    return this.prisma.musicTrack.findFirst({
      where: {},
      take: 1,
      skip: skip,
      include: {
        library: true,
        audioFingerprint: true,
        aiAnalysisResult: true,
        editorSessions: true,
        playbackSessions: true,
        imageSearches: true,
      },
    });
  }

  async getTrackRecommendations(id: string, criteria?: string) {
    const track = await this.prisma.musicTrack.findUnique({
      where: { id },
      include: {
        library: true,
        audioFingerprint: true,
        aiAnalysisResult: true,
        editorSessions: true,
        playbackSessions: true,
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
    });

    if (!track) {
      throw new NotFoundException(`Music track with ID ${id} not found`);
    }
    const boost = 1.5;
    const weights = DEFAULT_RECOMMENDATION_WEIGHTS;
    const boostedKeys = criteria?.split(',') || [];
    let boostedWeights = { ...weights };
    if (criteria) {
      boostedWeights = { ...ZERO_RECOMMENDATION_WEIGHTS };
      boostedKeys.forEach((key) => {
        boostedWeights[key] = weights[key] + boost;
      });
    }
    return this.recommendationService.getRecommendations([{ track }], {
      weights: boostedWeights,
      limit: 100,
      excludeTrackIds: [track.id],
    });
  }

  async deleteTracksFromLibrary(libraryId: string): Promise<void> {
    await this.prisma.musicTrack.deleteMany({
      where: { libraryId },
    });
  }

  async batchDelete(ids: string[]): Promise<any> {
    const result: any[] = [];
    for (const id of ids) {
      const track = await this.prisma.musicTrack.delete({
        where: { id },
      });
      result.push(track);
    }
    return result;
  }
}
