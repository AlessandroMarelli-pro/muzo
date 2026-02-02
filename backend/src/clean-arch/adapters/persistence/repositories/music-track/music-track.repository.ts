import { Injectable } from '@nestjs/common';
import { IMusicTrackRepository } from 'src/clean-arch/application/ports/repositories/IMusicTrackRepository';
import { Maybe } from 'src/clean-arch/kernel/common';
import { extractModelId, MusicTrackId } from 'src/clean-arch/kernel/ids';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import {
  FilterCriteria,
  MusicTrack,
} from 'src/clean-arch/kernel/types/model-types';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { buildMusicTrackFilterWhereClause } from '../../builders/music-track-filter.where';
import { handlePrismaNotFound } from '../prisma-errors';
import { toDomain } from './music-track.mapper';

@Injectable()
export class MusicTrackRepository implements IMusicTrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOneById(id: MusicTrackId): Promise<MusicTrack> {
    return this.prisma.musicTrack
      .findUniqueOrThrow({
        where: { id: extractModelId(id).dbId, createdById: getCurrentUserId() },
      })
      .catch((e: unknown) =>
        handlePrismaNotFound(e, `Music track with ID ${id} not found`),
      )
      .then(toDomain);
  }

  verifyExistence(id: MusicTrackId): Promise<boolean> {
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
    skipGenres: boolean,
    skipSubgenres: boolean,
    subgenreSelectionMode: 'exact' | 'contain',
    options: {
      limit?: Maybe<number>;
      offset?: Maybe<number>;
      orderBy?: Maybe<string>;
      orderDirection?: Maybe<'asc' | 'desc'>;
    } = {
      limit: 100,
      offset: 0,
      orderBy: 'fileCreatedAt',
      orderDirection: 'desc',
    },
  ): Promise<MusicTrack[]> {
    return this.prisma.musicTrack
      .findMany({
        where: await buildMusicTrackFilterWhereClause(
          criteria,
          skipGenres,
          skipSubgenres,
          subgenreSelectionMode,
        ),
        take: options.limit ?? undefined,
        skip: options.offset ?? undefined,
        orderBy: options.orderBy
          ? { [options.orderBy]: options.orderDirection }
          : undefined,
      })
      .then((rows) => {
        if (rows.length === 0) return [];
        return rows.map(toDomain);
      });
  }
}
