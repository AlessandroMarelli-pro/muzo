import { Playlist as PrismaPlaylist } from '@prisma/client';
import { Playlist } from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import { toDomainModel } from '../domain';

export type ToDomain = (row: PrismaPlaylist) => Playlist;

export const toDomain: ToDomain = (row: PrismaPlaylist): Playlist => {
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
