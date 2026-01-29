import { Playlist as PrismaPlaylist } from '@prisma/client';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { Playlist } from 'src/clean-arch/kernel/types/model-types';
import { toDbModel } from '../db';

export type ToPrisma = (domainModel: Playlist) => PrismaPlaylist;

export const toPrisma: ToPrisma = (domainModel: Playlist): PrismaPlaylist => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    userId: extractModelId(domainModel.createdById).dbId,
    name: domainModel.name,
    description: domainModel.description,
    isPublic: domainModel.isPublic,
  };
};
