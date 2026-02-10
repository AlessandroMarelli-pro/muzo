import { ScanSession as PrismaScanSession } from '@prisma/client';
import { Session } from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import { toDomainModel } from '../domain';

import { extractModelId } from 'src/clean-arch/kernel/ids';
import { toDbModel } from '../db';
export type ToDomain = (row: PrismaScanSession) => Session;

export const toDomain: ToDomain = (row) => {
  console.log('row', row);
  return {
    id: models.session.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
    }),
    status: row.status,
    totalBatches: row.totalBatches,
    completedBatches: row.completedBatches,
    totalTracks: row.totalTracks,
    completedTracks: row.completedTracks,
    failedTracks: row.failedTracks,
    overallProgress: row.overallProgress,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    errorMessage: row.errorMessage,
  };
};

export type ToPrisma = (domainModel: Session) => PrismaScanSession;

export const toPrisma: ToPrisma = (domainModel) => {
  console.log('domainModel', domainModel);
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    sessionId: domainModel.id,
    status: domainModel.status,
    totalBatches: domainModel.totalBatches,
    completedBatches: domainModel.completedBatches,
    totalTracks: domainModel.totalTracks,
    completedTracks: domainModel.completedTracks,
    failedTracks: domainModel.failedTracks,
    overallProgress: domainModel.overallProgress,
    startedAt: domainModel.startedAt,
    completedAt: domainModel.completedAt,
    errorMessage: domainModel.errorMessage,
  };
};
