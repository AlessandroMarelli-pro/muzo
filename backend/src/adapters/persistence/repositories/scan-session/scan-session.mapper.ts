import { ScanSession as PrismaScanSession } from '@prisma/client';
import { Session } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDomainModel } from '../domain';

import { extractModelId } from 'src/kernel/ids';
import { toDbModel } from '../db';

export type ToDomain = (row: PrismaScanSession) => Session;

export const toDomain: ToDomain = (row) => {
  return {
    id: models.session.id(row.id),
    sessionId: models.session.id(row.sessionId),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt ?? undefined,
      updatedById: row.updatedById ?? undefined,
    }),
    status: row.status,
    totalBatches: row.totalBatches,
    completedBatches: row.completedBatches,
    totalTracks: row.totalTracks,
    completedTracks: row.completedTracks,
    failedTracks: row.failedTracks,
    overallProgress: row.overallProgress,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
  };
};

export type ToPrisma = (domainModel: Session) => PrismaScanSession;

export const toPrisma: ToPrisma = (domainModel) => {
  const dbId = extractModelId(domainModel.id).dbId;
  return {
    ...toDbModel(domainModel),
    id: dbId,
    sessionId: dbId,
    status: domainModel.status,
    totalBatches: domainModel.totalBatches,
    completedBatches: domainModel.completedBatches,
    totalTracks: domainModel.totalTracks,
    completedTracks: domainModel.completedTracks,
    failedTracks: domainModel.failedTracks,
    overallProgress: domainModel.overallProgress,
    startedAt: domainModel.startedAt,
    completedAt: domainModel.completedAt ?? null,
    errorMessage: domainModel.errorMessage ?? null,
  };
};
