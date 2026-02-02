import { SavedFilter as PrismaSavedFilter } from '@prisma/client';
import { extractModelId } from 'src/clean-arch/kernel/ids';
import { SavedFilter } from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
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
  };
};

export type ToPrisma = (domainModel: SavedFilter) => PrismaSavedFilter;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    name: domainModel.name,
    criteria: JSON.stringify(domainModel.criteria),
  };
};
