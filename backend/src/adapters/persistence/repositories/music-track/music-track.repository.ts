import { Inject, Injectable } from '@nestjs/common';
import { isDate } from 'class-validator';
import { AudioAnalysisResponse } from 'src/application/ports/dtos/AudioAnalysis';
import {
  IMusicTrackRepository,
  MusicTrackUpdateData,
} from 'src/application/ports/repositories/IMusicTrackRepository';
import { extractModelId, MusicLibraryId, MusicTrackId, SubgenreId } from 'src/kernel/ids';
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

  async getAllSubgenresBySubgenreId(_subgenreIds: SubgenreId[]): Promise<SubgenreId[]> {
    const subgenres = await this.prisma.subgenre.findMany({
      where: {
        id: {
          in: _subgenreIds?.map((subgenreId) => extractModelId(subgenreId).dbId),
        },
      },
    });
    const hasTrance = subgenres.some((sg) => sg.name.toLocaleLowerCase().includes('trance'));
    const hasHouse = subgenres.some((sg) => sg.name.toLocaleLowerCase().includes('house'));
    const hasBalearic = subgenres.some((sg) => sg.name.toLocaleLowerCase().includes('balearic'));
    let subgenreIds: SubgenreId[] = [];
    if (hasTrance) {
      const allTranceSubgenres = await this.prisma.subgenre.findMany({
        where: { name: { contains: 'trance' } },
      });
      if (allTranceSubgenres?.length > 0) {
        subgenreIds.concat(
          allTranceSubgenres.map((ats) => models.subgenre.id(ats.id)) as SubgenreId[],
        );
      }
    }
    if (hasHouse) {
      const allTranceSubgenres = await this.prisma.subgenre.findMany({
        where: { name: { contains: 'house' } },
      });
      if (allTranceSubgenres?.length > 0) {
        subgenreIds.concat(
          allTranceSubgenres.map((ats) => models.subgenre.id(ats.id)) as SubgenreId[],
        );
      }
    }
    if (hasBalearic) {
      const allTranceSubgenres = await this.prisma.subgenre.findMany({
        where: { name: { contains: 'balearic' } },
      });
      if (allTranceSubgenres?.length > 0) {
        subgenreIds.concat(
          allTranceSubgenres.map((ats) => models.subgenre.id(ats.id)) as SubgenreId[],
        );
      }
    }
    return subgenreIds;
  }

  async getManyByLibraryIdNotCompleted(libraryId: MusicLibraryId): Promise<MusicTrack[]> {
    return this.prisma.musicTrack
      .findMany({
        where: {
          libraryId: extractModelId(libraryId).dbId,
          createdById: getCurrentUserId(),
          analysisStatus: { not: AudioFileAnalysisStatusEnum.COMPLETED },
        },
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

  async getTracksMissingEmbedding(): Promise<MusicTrack[]> {
    // Targets tracks missing EITHER the embedding OR the discogs-effnet classifier
    // outputs (they're computed together in one ai-service call, but a track can have
    // one without the other -- e.g. analyzed before classifiers existed, or a prior
    // backfill run failed partway). EmbeddingBackfillConsumerAdapter checks per-piece
    // state again before writing, so this is just the candidate pool, not the final word.
    return this.prisma.musicTrack
      .findMany({
        where: {
          createdById: getCurrentUserId(),
          OR: [
            { audioFingerprint: { is: { embedding: '[]' } } },
            { audioFingerprint: { is: { voice: null } } },
          ],
        },
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
    const where = buildMusicTrackFilterWhereClause(criteria, 'contain');
    const scopedWhere = { ...where, createdById: getCurrentUserId() };
    const count = await this.prisma.musicTrack.count({ where: scopedWhere });
    return this.prisma.musicTrack
      .findMany({
        where: scopedWhere,
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
      .then((row) => toMusicTrackId(row as any))
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
    filePath: string,
  ): Promise<void> {
    const updateData: any = {};

    // Update duration if available
    if (analysisResult.audio?.duration_s) {
      updateData.duration = Math.round(analysisResult.audio.duration_s);
    }

    // Update audio format details
    if (analysisResult.audio?.format) {
      updateData.format = analysisResult.audio.format;
    }
    if (analysisResult.audio?.bitrate) {
      updateData.bitrate = analysisResult.audio.bitrate;
    }
    if (analysisResult.audio?.sample_rate) {
      updateData.sampleRate = analysisResult.audio.sample_rate;
    }

    // A file that is itself lossless (flac/wav/aiff) already IS the HQ copy —
    // no need to acquire one separately. Mirrors AcquireHqAudioUseCase's rule.
    const LOSSLESS_FORMATS = new Set(['flac', 'wav', 'aiff', 'aif']);
    const ext = filePath.split('.').pop()?.toLowerCase();
    const probedFormat = analysisResult.audio?.format?.toLowerCase();
    if (
      (ext && LOSSLESS_FORMATS.has(ext)) ||
      (probedFormat && LOSSLESS_FORMATS.has(probedFormat))
    ) {
      updateData.hqAudioPath = filePath;
    }

    // aiConfidence used to come from the LLM's hierarchical_classification,
    // which v2 no longer produces. Repurpose it from the top Discogs genre
    // prediction instead, so the existing index and any UI sort on this
    // column keep meaning something.
    const topGenre = analysisResult.classifications?.genres?.[0];
    if (topGenre) {
      updateData.aiConfidence = topGenre.confidence;
    }

    // Update original metadata if available
    if (analysisResult.tags) {
      if (analysisResult.tags.title) {
        updateData.originalTitle = analysisResult.tags.title;
      }
      if (analysisResult.tags.artist) {
        updateData.originalArtist = analysisResult.tags.artist;
      }
      if (analysisResult.tags.album) {
        updateData.originalAlbum = analysisResult.tags.album;
      }
      if (analysisResult.tags.albumartist) {
        updateData.originalAlbumartist = analysisResult.tags.albumartist;
      }
      if (analysisResult.tags.date && isDate(new Date(analysisResult.tags.date))) {
        updateData.originalDate = new Date(analysisResult.tags.date);
      }

      if (analysisResult.tags.bpm) {
        updateData.originalBpm = parseInt(analysisResult.tags.bpm, 10);
      }
      if (analysisResult.tags.track_number) {
        updateData.originalTrack_number = parseInt(analysisResult.tags.track_number, 10);
      }
      if (analysisResult.tags.disc_number) {
        updateData.originalDisc_number = analysisResult.tags.disc_number;
      }

      if (analysisResult.tags.year) {
        // Parse originalYear to support both YYYY and YYYYMMDD formats
        let parsedOriginalYear: number | null = null;

        const year = analysisResult.tags.year;
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

      if (analysisResult.tags.comment) {
        updateData.originalComment = analysisResult.tags.comment;
      }
      if (analysisResult.tags.composer) {
        updateData.originalComposer = analysisResult.tags.composer;
      }
      if (analysisResult.tags.copyright) {
        updateData.originalCopyright = analysisResult.tags.copyright;
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
