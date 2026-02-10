import { ImageSearch as PrismaImageSearch } from '@prisma/client';
import { CreateImageSearchData } from 'src/application/ports/repositories/IImageSearchRepository';
import { ImageSearch } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { toDomainModel } from '../domain';

export function toDomain(row: PrismaImageSearch): ImageSearch {
  return {
    id: models.imageSearch.id(row.id),
    ...toDomainModel({
      createdAt: row.createdAt,
      createdById: row.createdById,
      updatedAt: row.updatedAt ?? undefined,
      updatedById: row.updatedById ?? undefined,
    }),
    trackId: models.musicTrack.id(row.trackId),
    searchUrl: row.searchUrl,
    imagePath: row.imagePath ?? '',
    imageUrl: row.imageUrl ?? '',
    error: row.error ?? null,
  };
}

export function toPrismaCreate(
  trackIdDb: string,
  data: CreateImageSearchData,
  createdById: string,
) {
  return {
    trackId: trackIdDb,
    searchUrl: data.searchUrl,
    status: 'COMPLETED' as const,
    imagePath: data.imagePath ?? null,
    imageUrl: data.imageUrl ?? null,
    source: data.source ?? null,
    createdById,
  };
}
