import { CosineTrackMatch as PrismaCosineTrackMatch } from '@prisma/client';
import {
  CosineTrackMatchMethod,
  UpsertCosineTrackMatchData,
} from 'src/application/ports/repositories/ICosineTrackMatchRepository';
import { CosineTrackMatch } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDomainModel } from '../domain';

export function toDomain(row: PrismaCosineTrackMatch): CosineTrackMatch {
  return {
    id: models.cosineTrackMatch.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt ?? undefined,
      updatedById: row.updatedById ?? undefined,
    }),
    musicTrackId: models.musicTrack.id(row.musicTrackId),
    cosineTrackId: row.cosineTrackId,
    matchMethod: row.matchMethod as CosineTrackMatchMethod,
  };
}

export function toPrismaUpsert(
  data: UpsertCosineTrackMatchData,
  musicTrackIdDb: string,
  userId: string,
) {
  return {
    create: {
      musicTrackId: musicTrackIdDb,
      cosineTrackId: data.cosineTrackId,
      matchMethod: data.matchMethod,
      createdById: userId,
    },
    update: {
      cosineTrackId: data.cosineTrackId,
      matchMethod: data.matchMethod,
      updatedById: userId,
    },
  };
}
