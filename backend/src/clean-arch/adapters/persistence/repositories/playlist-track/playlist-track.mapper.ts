import { PlaylistTrack as PrismaPlaylistTrack } from '@prisma/client';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { PlaylistTrack } from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';

export type ToDomain = (row: PrismaPlaylistTrack) => PlaylistTrack;

export const toDomain: ToDomain = (row) => {
  return {
    id: models.playlistTrack.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
    }),
    trackId: models.musicTrack.id(row.trackId),
    playlistId: models.playlist.id(row.playlistId),
    position: row.position,
    addedAt: row.addedAt,
  };
};

export type ToPrisma = (domainModel: PlaylistTrack) => PrismaPlaylistTrack;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    trackId: extractModelId(domainModel.trackId).dbId,
    playlistId: extractModelId(domainModel.playlistId).dbId,
    position: domainModel.position,
    addedAt: domainModel.addedAt,
  };
};
