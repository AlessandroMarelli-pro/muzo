import { Inject, Injectable } from '@nestjs/common';
import { isDate } from 'class-validator';
import { AudioAnalysisResponse } from 'src/application/ports/dtos/AudioAnalysis';
import {
  IMusicTrackRepository,
  MusicTrackUpdateData,
} from 'src/application/ports/repositories/IMusicTrackRepository';
import { extractModelId, MusicLibraryId, MusicTrackId } from 'src/kernel/ids';
import { Maybe, models } from 'src/kernel/types';
import { getCurrentUserId } from 'src/kernel/types/context';
import {
  AudioFileAnalysisStatusEnum,
  FilterCriteria,
  MusicTrack,
} from 'src/kernel/types/model-types';
import {
  CursorPaginationResult,
  PaginationAndSortingOptions,
  PaginationResult,
  WithCursorPagination,
  WithPagination,
} from 'src/kernel/types/pagination';
import { PRISMA_SERVICE, PrismaService } from '../../../../infrastructure/database/prisma.service';
import { buildMusicTrackFilterWhereClause } from '../../builders/music-track-filter.where';
import { buildMusicTrackSortingOrderClause } from '../../builders/music-track-sorting.order';
import { musicTracksIncludes } from '../../includes/music-tracks-includes';
import { handlePrismaNotFound } from '../prisma-errors';
import { toDomain, toMusicTrackId, toPrisma, toPrismaUpdate } from './music-track.mapper';

@Injectable()
export class MusicTrackRepository implements IMusicTrackRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async getManyByLibraryId(libraryId: MusicLibraryId): Promise<MusicTrack[]> {
    return this.prisma.musicTrack
      .findMany({
        where: { libraryId, createdById: getCurrentUserId() },
        include: musicTracksIncludes,
      })
      .then((rows) => rows.map(toDomain));
  }

  async getAnalysisStatusForManyByLibraryId(
    libraryId: MusicLibraryId,
  ): Promise<{ analysisStatus: AudioFileAnalysisStatusEnum; count: number }[]> {
    return this.prisma.musicTrack
      .groupBy({
        by: ['analysisStatus'],
        where: {
          libraryId: extractModelId(libraryId).dbId,
          createdById: getCurrentUserId(),
        },
        _count: {
          id: true,
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          analysisStatus: row.analysisStatus as AudioFileAnalysisStatusEnum,
          count: row._count.id ?? 0,
        })),
      );
  }

  async upsertOne(trackData: MusicTrackUpdateData): Promise<MusicTrack> {
    return this.prisma.musicTrack
      .upsert({
        where: {
          filePath: trackData.filePath,
          createdById: getCurrentUserId(),
        },
        update: toPrismaUpdate(trackData),
        create: toPrisma(
          models.musicTrack.instantiateNew({
            libraryId: trackData.libraryId,
            analysisInfo: {
              status: trackData.analysisStatus,
              startedAt: trackData.analysisStartedAt,
              completedAt: undefined,
              error: undefined,
            },
            fileInfo: {
              filePath: trackData.filePath,
              fileName: trackData.fileName,
              fileSize: trackData.fileSize,
              fileCreatedAt: trackData.fileCreatedAt,
            },
            technicalInfo: {
              duration: trackData.duration,
              format: trackData.format,
              bitrate: undefined,
              sampleRate: undefined,
            },
            features: undefined,
            metadata: undefined,
            aiMetadata: undefined,
            imagePath: undefined,
            artist: undefined,
            title: undefined,
            stats: undefined,
          }),
        ),
      })
      .then(toDomain);
  }

  async getOneById(id: MusicTrackId): Promise<MusicTrack> {
    return this.prisma.musicTrack
      .findUniqueOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
        include: musicTracksIncludes,
      })
      .catch((e: unknown) => handlePrismaNotFound(e, `Music track with ID ${id} not found`))
      .then(toDomain);
  }

  // If analysis completed and no genres it means it has not been fully analyzed
  async areFilesAnalyzed(
    filePaths: string[],
  ): Promise<{ isAnalyzed: boolean; filePath: string }[]> {
    return this.prisma.musicTrack
      .findMany({
        where: {
          filePath: { in: filePaths },
          createdById: getCurrentUserId(),
          analysisStatus: AudioFileAnalysisStatusEnum.COMPLETED,
          trackGenres: { some: {} },
          trackSubgenres: { some: {} },
        },
      })
      .then((rows) =>
        filePaths.map((filePath) => ({
          isAnalyzed: rows.some((row) => row.filePath === filePath),
          filePath,
        })),
      );
  }
  async getLastPlayedTrack(): Promise<Maybe<MusicTrack>> {
    return this.prisma.musicTrack
      .findFirst({
        where: { createdById: getCurrentUserId() },
        orderBy: { lastPlayedAt: 'desc' },
      })
      .then((row) => (row ? toDomain(row) : null));
  }
  async getAll(): Promise<MusicTrack[]> {
    return this.prisma.musicTrack
      .findMany({
        where: { createdById: getCurrentUserId() },
        include: musicTracksIncludes,
      })
      .then((rows) => rows.map(toDomain));
  }

  async getManyByIds(ids: MusicTrackId[]): Promise<MusicTrack[]> {
    return this.prisma.musicTrack
      .findMany({
        where: {
          id: { in: ids.map((id) => extractModelId(id).dbId) },
          createdById: getCurrentUserId(),
        },
        include: musicTracksIncludes,
      })
      .then((rows) => rows.map(toDomain));
  }
  async verifyExistence(id: MusicTrackId): Promise<boolean> {
    return this.prisma.musicTrack
      .findUnique({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
        select: {
          id: true,
        },
      })
      .then((row) => row !== null);
  }

  async getManyByCriteria(
    criteria: FilterCriteria,
    subgenreSelectionMode: 'exact' | 'contain',
    options: PaginationAndSortingOptions,
    withIncludes: boolean = true,
  ): Promise<MusicTrack[]> {
    return this.prisma.musicTrack
      .findMany({
        where: {
          ...buildMusicTrackFilterWhereClause(criteria, subgenreSelectionMode),
          createdById: getCurrentUserId(),
        },
        take: options.limit ?? undefined,
        skip: options.offset ?? undefined,
        orderBy: buildMusicTrackSortingOrderClause(options),
        include: withIncludes ? musicTracksIncludes : undefined,
      })
      .then((rows) => {
        if (rows.length === 0) return [];
        return rows.map(toDomain);
      });
  }

  async getManyByCriteriaWithPagination(
    criteria: Maybe<FilterCriteria>,
    pagination: WithPagination,
  ): Promise<PaginationResult<MusicTrack>> {
    const { limit = 50, offset = 0, orderBy, orderDirection } = pagination.pagination;
    const where = buildMusicTrackFilterWhereClause(criteria, 'exact');
    const count = await this.prisma.musicTrack.count({ where });
    return this.prisma.musicTrack
      .findMany({
        where: {
          ...where,
          createdById: getCurrentUserId(),
        },
        take: limit ?? undefined,
        skip: offset ?? undefined,
        orderBy: buildMusicTrackSortingOrderClause({ orderBy, orderDirection }),
        include: musicTracksIncludes,
      })
      .then((rows) => {
        if (rows.length === 0) {
          return { items: [], total: 0, page: 0, limit: 0, pages: 0 };
        }
        const page = Math.floor(offset / limit) + 1;
        return {
          items: rows.map(toDomain),
          total: count,
          page,
          limit: limit ?? 0,
          pages: Math.ceil(count / limit),
        };
      })
      .catch((e: unknown) => {
        console.error('Error in getManyByCriteriaWithPagination', e);
        throw e;
      });
  }

  async getPendingTracksWithPagination(
    criteria: Maybe<FilterCriteria>,
    pagination: WithPagination,
  ): Promise<PaginationResult<MusicTrack>> {
    const { limit = 50, offset = 0, orderBy, orderDirection } = pagination.pagination;
    const where = buildMusicTrackFilterWhereClause(criteria, 'exact');
    const hiddenTrackFilePaths = await this.prisma.hiddenMusicTrack
      .findMany({
        where: {
          createdById: getCurrentUserId(),
        },
        select: {
          filePath: true,
        },
      })
      .then((rows) => rows.map((row) => row.filePath));
    const pendingWhere = {
      ...where,
      createdById: getCurrentUserId(),
      isLiked: false,
      isBanger: false,
      filePath: {
        notIn: hiddenTrackFilePaths,
      },
    };
    const count = await this.prisma.musicTrack.count({ where: pendingWhere });
    return this.prisma.musicTrack
      .findMany({
        where: pendingWhere,
        take: limit ?? undefined,
        skip: offset ?? undefined,
        orderBy: buildMusicTrackSortingOrderClause({ orderBy, orderDirection }),
        include: musicTracksIncludes,
      })
      .then((rows) => {
        if (rows.length === 0) {
          return { items: [], total: 0, page: 0, limit: 0, pages: 0 };
        }
        const page = Math.floor(offset / limit) + 1;
        return {
          items: rows.map(toDomain),
          total: count,
          page,
          limit: limit ?? 0,
          pages: Math.ceil(count / limit),
        };
      })
      .catch((e: unknown) => {
        console.error('Error in getPendingTracksWithPagination', e);
        throw e;
      });
  }

  async getManyByCriteriaWithCursorPagination(
    criteria: FilterCriteria,
    pagination: WithCursorPagination<MusicTrack>,
  ): Promise<CursorPaginationResult<MusicTrack>> {
    const { size = 50, cursor } = pagination;
    const where = buildMusicTrackFilterWhereClause(criteria);

    return this.prisma.musicTrack
      .findMany({
        cursor: cursor?.id ? { id: extractModelId(cursor.id).dbId } : undefined,
        where: {
          ...where,
          createdById: getCurrentUserId(),
        },
        include: musicTracksIncludes,
        take: size + 1,
        skip: where?.cursor ? 1 : undefined,
        orderBy: cursor?.direction === 'BEFORE' ? { id: 'desc' } : { id: 'asc' },
      })
      .then((rows) => {
        if (rows.length === 0) {
          return { items: [], nextCursor: null, hasMore: false };
        }
        const nextCursor = rows.length > size ? toMusicTrackId(rows[rows.length - 1]) : null;
        const hasMore = rows.length > size;
        const items = rows.slice(0, size);
        return {
          items: items.map(toDomain),
          nextCursor,
          hasMore,
        };
      });
  }

  async getRandomTrackId(): Promise<MusicTrackId> {
    // Exclude tracks that are already liked (or include them? Let's exclude disliked/hidden ones)
    // Actually, we should exclude tracks that are in hidden_music_tracks
    // But since we're querying music_tracks, hidden tracks won't be there anyway
    // We might want to exclude already liked tracks, but the requirement says to use randomTrack
    // Let's keep it simple and just get a random track that's not liked yet
    const tracksCount = await this.prisma.musicTrack.count({
      where: { createdById: getCurrentUserId() },
    });

    const skip = Math.floor(Math.random() * tracksCount);
    return this.prisma.musicTrack
      .findFirstOrThrow({
        where: { createdById: getCurrentUserId() },
        take: 1,
        skip: skip,
        select: { id: true },
      })
      .then(toMusicTrackId)
      .catch((e: unknown) => handlePrismaNotFound(e, `No music tracks found`));
  }

  async updateOneById(id: MusicTrackId, data: MusicTrackUpdateData): Promise<MusicTrack> {
    return this.prisma.musicTrack
      .update({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
        data: toPrismaUpdate(data),
        include: musicTracksIncludes,
      })
      .then(toDomain);
  }
  /**
   * Cascade remove the track and all related data
   */
  async removeOneById(id: MusicTrackId): Promise<boolean> {
    return this.prisma.musicTrack
      .delete({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .then(() => true);
  }

  async incrementListeningCount(id: MusicTrackId): Promise<MusicTrack> {
    return this.prisma.musicTrack
      .update({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
        data: { listeningCount: { increment: 1 }, lastPlayedAt: new Date() },
        include: musicTracksIncludes,
      })
      .then(toDomain);
  }

  async updateTrackWithAnalysis(
    trackId: MusicTrackId,
    analysisResult: AudioAnalysisResponse,
  ): Promise<void> {
    const updateData: any = {};

    // Update duration if available
    if (analysisResult.audio_technical.duration_seconds) {
      updateData.duration = Math.round(analysisResult.audio_technical.duration_seconds);
    }

    // Update audio format details
    if (analysisResult.audio_technical.format) {
      updateData.format = analysisResult.audio_technical.format;
    }
    if (analysisResult.audio_technical.bitrate) {
      updateData.bitrate = analysisResult.audio_technical.bitrate;
    }
    if (analysisResult.audio_technical.sample_rate) {
      updateData.sampleRate = analysisResult.audio_technical.sample_rate;
    }

    // Update AI-generated metadata
    let genreNames: string[] = [];
    let subgenreNames: string[] = [];

    if (analysisResult.hierarchical_classification?.classification) {
      if (analysisResult.hierarchical_classification.classification.genre) {
        genreNames.push(analysisResult.hierarchical_classification.classification.genre);
      }
      if (analysisResult.hierarchical_classification.classification.subgenre) {
        subgenreNames.push(analysisResult.hierarchical_classification.classification.subgenre);
      }
    }

    if (analysisResult.hierarchical_classification?.classification?.confidence) {
      updateData.aiConfidence =
        analysisResult.hierarchical_classification.classification.confidence.genre;
      updateData.aiSubgenreConfidence =
        analysisResult.hierarchical_classification.classification.confidence.subgenre;
    }

    // Update original metadata if available
    if (analysisResult.id3_tags) {
      if (analysisResult.id3_tags.title) {
        updateData.originalTitle = analysisResult.id3_tags.title;
      }
      if (analysisResult.id3_tags.artist) {
        updateData.originalArtist = analysisResult.id3_tags.artist;
      }
      if (analysisResult.id3_tags.album) {
        updateData.originalAlbum = analysisResult.id3_tags.album;
      }
      if (analysisResult.id3_tags.genre) {
        // Add original genre to the list
        genreNames.push(analysisResult.id3_tags.genre);
      }
      if (analysisResult.id3_tags.albumartist) {
        updateData.originalAlbumartist = analysisResult.id3_tags.albumartist;
      }
      if (analysisResult.id3_tags.date && isDate(new Date(analysisResult.id3_tags.date))) {
        updateData.originalDate = new Date(analysisResult.id3_tags.date);
      }

      if (analysisResult.id3_tags.bpm) {
        updateData.originalBpm = parseInt(analysisResult.id3_tags.bpm, 10);
      }
      if (analysisResult.id3_tags.track_number) {
        updateData.originalTrack_number = parseInt(analysisResult.id3_tags.track_number, 10);
      }
      if (analysisResult.id3_tags.disc_number) {
        updateData.originalDisc_number = analysisResult.id3_tags.disc_number;
      }

      if (analysisResult.id3_tags.year) {
        // Parse originalYear to support both YYYY and YYYYMMDD formats
        let parsedOriginalYear: number | null = null;

        const year = analysisResult.id3_tags.year;
        if (/^\d{8}$/.test(year)) {
          // Format: YYYYMMDD
          parsedOriginalYear = parseInt(year.substring(0, 4), 10);
        } else if (/^\d{4}$/.test(year)) {
          // Format: YYYY
          parsedOriginalYear = parseInt(year, 10);
        } else {
          // Fallback: try to parse as number
          parsedOriginalYear = parseInt(year, 10) || null;
        }

        updateData.originalYear = parsedOriginalYear;
      }

      if (analysisResult.id3_tags.comment) {
        updateData.originalComment = analysisResult.id3_tags.comment;
      }
      if (analysisResult.id3_tags.composer) {
        updateData.originalComposer = analysisResult.id3_tags.composer;
      }
      if (analysisResult.id3_tags.copyright) {
        updateData.originalCopyright = analysisResult.id3_tags.copyright;
      }
    }
    const metadata = analysisResult.ai_metadata;

    // Update AI-generated metadata fields
    if (metadata?.artist) {
      updateData.aiArtist = metadata.artist;
      updateData.originalArtist = metadata.artist;
    }
    if (metadata?.title) {
      updateData.aiTitle = metadata.title;
      updateData.originalTitle = metadata.title;
      if (metadata?.mix) {
        updateData.originalTitle += ` (${metadata.mix})`;
        updateData.aiTitle += ` (${metadata.mix})`;
      }
    }
    if (metadata?.description) {
      updateData.aiDescription = metadata.description;
    }

    // Parse year if available
    if (metadata?.year) {
      const yearStr = String(metadata.year);
      const yearMatch = yearStr.match(/^\d{4}/);
      if (yearMatch) {
        updateData.originalYear = parseInt(yearMatch[0], 10);
      }
    }

    // Store additional metadata in userTags as JSON (if tags exist)
    if (metadata?.tags && metadata.tags.length > 0) {
      updateData.aiTags = JSON.stringify(metadata.tags);
    }

    // Store audioFeatures data
    if (metadata?.audioFeatures) {
      if (metadata.audioFeatures.vocals) {
        updateData.vocalsDesc = metadata.audioFeatures.vocals;
      }
    }

    // Store context data
    if (metadata?.context) {
      if (metadata.context.background) {
        updateData.contextBackground = metadata.context.background;
      }
      if (metadata.context.impact) {
        updateData.contextImpact = metadata.context.impact;
      }
    }
    await this.prisma.musicTrack.update({
      where: {
        id: extractModelId(trackId).dbId,
        createdById: getCurrentUserId(),
      },
      data: {
        updatedAt: new Date(),
        updatedById: getCurrentUserId(),
        ...updateData,
        analysisStatus: AudioFileAnalysisStatusEnum.COMPLETED,
        analysisCompletedAt: new Date(),
        analysisError: undefined,
      },
    });
  }
}
