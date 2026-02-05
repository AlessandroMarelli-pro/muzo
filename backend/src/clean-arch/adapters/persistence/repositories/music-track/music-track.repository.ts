import { Injectable } from '@nestjs/common';
import {
  IMusicTrackRepository,
  MusicTrackUpdateData,
} from 'src/clean-arch/application/ports/repositories/IMusicTrackRepository';
import { extractModelId, MusicTrackId } from 'src/clean-arch/kernel/ids';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import {
  FilterCriteria,
  MusicTrack,
} from 'src/clean-arch/kernel/types/model-types';
import {
  CursorPaginationResult,
  PaginationAndSortingOptions,
  PaginationResult,
  WithCursorPagination,
  WithPagination,
} from 'src/clean-arch/kernel/types/pagination';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { buildMusicTrackFilterWhereClause } from '../../builders/music-track-filter.where';
import { buildMusicTrackSortingOrderClause } from '../../builders/music-track-sorting.order';
import { musicTracksIncludes } from '../../includes/music-tracks-includes';
import { handlePrismaNotFound } from '../prisma-errors';
import { toDomain, toMusicTrackId, toPrismaUpdate } from './music-track.mapper';

@Injectable()
export class MusicTrackRepository implements IMusicTrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOneById(id: MusicTrackId): Promise<MusicTrack> {
    return this.prisma.musicTrack
      .findUniqueOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
        include: musicTracksIncludes,
      })
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Music track with ID ${id} not found`),
      )
      .then(toDomain);
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
        where: buildMusicTrackFilterWhereClause(
          criteria,
          subgenreSelectionMode,
        ),
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
    criteria: FilterCriteria,
    pagination: WithPagination,
  ): Promise<PaginationResult<MusicTrack>> {
    const { limit, offset, orderBy, orderDirection } = pagination.pagination;
    const where = buildMusicTrackFilterWhereClause(criteria);
    const count = await this.prisma.musicTrack.count({ where });
    return this.prisma.musicTrack
      .findMany({
        where,
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

  async getManyByCriteriaWithCursorPagination(
    criteria: FilterCriteria,
    pagination: WithCursorPagination<MusicTrack>,
  ): Promise<CursorPaginationResult<MusicTrack>> {
    const { size = 50, cursor } = pagination;
    const where = buildMusicTrackFilterWhereClause(criteria);

    return this.prisma.musicTrack
      .findMany({
        cursor: cursor?.id ? { id: extractModelId(cursor.id).dbId } : undefined,
        where,
        include: musicTracksIncludes,
        take: size + 1,
        skip: where?.cursor ? 1 : undefined,
        orderBy:
          cursor?.direction === 'BEFORE' ? { id: 'desc' } : { id: 'asc' },
      })
      .then((rows) => {
        if (rows.length === 0) {
          return { items: [], nextCursor: null, hasMore: false };
        }
        const nextCursor =
          rows.length > size ? toMusicTrackId(rows[rows.length - 1]) : null;
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
    const tracksCount = await this.prisma.musicTrack.count();

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

  async updateOneById(
    id: MusicTrackId,
    data: MusicTrackUpdateData,
  ): Promise<MusicTrack> {
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
        data: { listeningCount: { increment: 1 } },
        include: musicTracksIncludes,
      })
      .then(toDomain);
  }
}
