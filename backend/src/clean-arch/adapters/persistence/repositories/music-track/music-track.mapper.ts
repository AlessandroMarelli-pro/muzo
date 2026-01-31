import { MusicTrack as PrismaMusicTrack } from '@prisma/client';

import { extractModelId } from 'src/clean-arch/kernel/ids/factory';

import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import { toDbModel } from '../db';
import { toDomainModel } from '../domain';

export type ToDomain = (row: PrismaMusicTrack) => MusicTrack;

export const toDomain: ToDomain = (row) => {
  return {
    id: models.musicTrack.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
    }),
    title: row.originalTitle,
    artist: row.originalArtist,
    duration: row.duration,
    date: row.originalDate,
    isFavorite: row.isFavorite,
    isLiked: row.isLiked,
    isBanger: row.isBanger,
  };
};

export type ToPrisma = (
  domainModel: MusicTrack,
) => Pick<PrismaMusicTrack, 'id' | 'originalTitle' | 'originalArtist'>;

export const toPrisma: ToPrisma = (domainModel) => {
  return {
    ...toDbModel(domainModel),
    id: extractModelId(domainModel.id).dbId,
    originalTitle: domainModel.title,
    originalArtist: domainModel.artist,
    duration: domainModel.duration,
    originalDate: domainModel.date,
    isFavorite: domainModel.isFavorite,
    isLiked: domainModel.isLiked,
    isBanger: domainModel.isBanger,
  };
};
