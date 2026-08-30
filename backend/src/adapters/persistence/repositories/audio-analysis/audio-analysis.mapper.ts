import {
  Genre as PrismaGenre,
  Subgenre as PrismaSubgenre,
  TrackGenre as PrismaTrackGenre,
  TrackSubgenre as PrismaTrackSubgenre,
} from '@prisma/client';
import { extractModelId } from 'src/kernel/ids';
import { Genre, Subgenre, TrackGenre, TrackSubgenre } from 'src/kernel/types';
import { toDbModel } from '../db';

// Genre / Subgenre carry no createdById/updatedById in the DB (reference data),
// so unlike the other mappers they don't spread toDbModel.
export const toPrismaGenre = (domain: Genre): PrismaGenre => {
  return {
    id: extractModelId(domain.id).dbId,
    name: domain.name,
    description: domain.description ?? null,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt ?? null,
  };
};

export const toPrismaTrackGenre = (domain: TrackGenre): PrismaTrackGenre => {
  return {
    ...toDbModel(domain),
    id: extractModelId(domain.id).dbId,
    trackId: extractModelId(domain.trackId).dbId,
    genreId: extractModelId(domain.genreId).dbId,
    confidence: domain.confidence ?? null,
  };
};

export const toPrismaSubgenre = (domain: Subgenre): PrismaSubgenre => {
  return {
    id: extractModelId(domain.id).dbId,
    name: domain.name,
    description: domain.description ?? null,
    genreId: domain.genreId ? extractModelId(domain.genreId).dbId : null,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt ?? null,
  };
};

export const toPrismaTrackSubgenre = (domain: TrackSubgenre): PrismaTrackSubgenre => {
  return {
    ...toDbModel(domain),
    id: extractModelId(domain.id).dbId,
    trackId: extractModelId(domain.trackId).dbId,
    subgenreId: extractModelId(domain.subgenreId).dbId,
    confidence: domain.confidence ?? null,
  };
};
