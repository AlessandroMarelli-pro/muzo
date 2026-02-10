import { SavedFilter as PrismaSavedFilter } from '@prisma/client';
import { SavedFilterData } from 'src/application/ports/repositories/ISavedFilterRepository';
import { extractModelId } from 'src/kernel/ids';
import { now, user } from 'src/kernel/types/context';
import { SavedFilter } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';

type ToDomain = (row: PrismaSavedFilter) => SavedFilter;

export const toDomain: ToDomain = (row) => {
  return {
    id: models.savedFilter.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
    }),
    name: row.name,
    criteria: JSON.parse(row.criteria),
    isCurrent: row.isCurrent ?? false,
  };
};

export type ToPrisma = (domainModel: SavedFilter) => PrismaSavedFilter;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    name: domainModel.name,
    criteria: JSON.stringify(domainModel.criteria),
    isCurrent: domainModel.isCurrent ?? false,
  };
};

export type ToPrismaUpdateData = (
  data: SavedFilterData,
) => Partial<PrismaSavedFilter>;

export const toPrismaUpdateData: ToPrismaUpdateData = (data) => {
  const result: Partial<PrismaSavedFilter> = {
    updatedAt: now(),
    updatedById: extractModelId(user().id).dbId,
  };

  return {
    ...result,
    name: data.name,
    criteria: JSON.stringify(data.criteria),
    isCurrent: data.isCurrent ?? false,
  };
};
