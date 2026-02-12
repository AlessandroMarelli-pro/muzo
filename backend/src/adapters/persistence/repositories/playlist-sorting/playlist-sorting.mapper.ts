import { PlaylistSorting as PrismaPlaylistSorting } from '@prisma/client';
import { extractModelId } from 'src/kernel/ids';
import { PlaylistSorting } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';

type ToDomain = (row: PrismaPlaylistSorting) => PlaylistSorting;

export const toDomain: ToDomain = (row) => {
  return {
    id: models.playlistSorting.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt ?? undefined,
      updatedById: row.updatedById ?? undefined,
    }),
    playlistId: models.playlist.id(row.playlistId),
    sortingKey: row.sortingKey,
    sortingDirection: row.sortingDirection,
  };
};

export type ToPrisma = (domainModel: PlaylistSorting) => PrismaPlaylistSorting;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    playlistId: extractModelId(domainModel.playlistId).dbId,
    sortingKey: domainModel.sortingKey,
    sortingDirection: domainModel.sortingDirection,
  };
};
