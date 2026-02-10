import { fail, MaybeUndefined } from 'src/kernel/common';
import { models } from 'src/kernel/types/models';

type DbModelBase = {
  createdAt: Date;
  createdById: string;
  updatedAt: MaybeUndefined<Date>;
  updatedById: MaybeUndefined<string>;
};

export function toDomainModel(dbModel: DbModelBase) {
  if (!dbModel.createdById?.trim()) fail('createdById is required');
  const createdById = models.user.id(dbModel.createdById.trim());

  const updatedById = dbModel.updatedById?.trim()
    ? models.user.id(dbModel.updatedById.trim())
    : undefined;
  return {
    createdAt: dbModel.createdAt,
    createdById,
    updatedAt: dbModel.updatedAt,
    updatedById,
  };
}
