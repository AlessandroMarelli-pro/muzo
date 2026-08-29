import {
  Genre as PrismaGenre,
  Subgenre as PrismaSubgenre,
  TrackGenre as PrismaTrackGenre,
  TrackSubgenre as PrismaTrackSubgenre,
} from '@prisma/client';
import { extractModelId } from 'src/kernel/ids';
import { Genre, Subgenre, TrackGenre, TrackSubgenre } from 'src/kernel/types';
import { toDbModel } from '../db';

export const toPrismaGenre = (domain: Genre): PrismaGenre => {
  return {
    ...toDbModel(domain),
    id: extractModelId(domain.id).dbId,
    name: domain.name,
    description: domain.description ?? null,
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
    ...toDbModel(domain),
    id: extractModelId(domain.id).dbId,
    name: domain.name,
    description: domain.description ?? null,
    genreId: domain.genreId ? extractModelId(domain.genreId).dbId : null,
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
