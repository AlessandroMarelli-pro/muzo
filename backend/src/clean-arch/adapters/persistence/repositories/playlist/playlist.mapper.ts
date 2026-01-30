import { Playlist as PrismaPlaylist } from '@prisma/client';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { Playlist } from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';

export type ToDomain = (row: PrismaPlaylist) => Playlist;

export const toDomain: ToDomain = (row) => {
  return {
    id: models.playlist.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
    }),
    name: row.name,
    description: row.description ?? null,
    isPublic: row.isPublic,
  };
};

export type ToPrisma = (domainModel: Playlist) => PrismaPlaylist;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    userId: extractModelId(domainModel.createdById).dbId,
    name: domainModel.name,
    description: domainModel.description,
    isPublic: domainModel.isPublic,
  };
};

export type ToPrismaUpdateData = (
  domainModel: Playlist,
) => Pick<
  PrismaPlaylist,
  'updatedAt' | 'updatedById' | 'name' | 'description' | 'isPublic'
>;

export const toPrismaUpdateData: ToPrismaUpdateData = (domainModel) => {
  return {
    updatedAt: new Date(),
    updatedById: extractModelId(domainModel.updatedById).dbId,
    name: domainModel.name,
    description: domainModel.description,
    isPublic: domainModel.isPublic,
  };
};
