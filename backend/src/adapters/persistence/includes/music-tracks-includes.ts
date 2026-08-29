// playlist-includes.ts
import { Prisma } from '@prisma/client';

export const trackGenresInclude = {
  genre: true,
} satisfies Prisma.TrackGenreInclude;

export const musicTracksIncludes = {
  audioFingerprint: true,
  imageSearches: true,
  trackGenres: { include: { genre: true } },
  trackSubgenres: { include: { subgenre: true } },
} satisfies Prisma.MusicTrackInclude;
