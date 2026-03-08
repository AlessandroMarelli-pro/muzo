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
  trackAiAtmosphereTags: { include: { aiAtmosphereTag: true } },
} satisfies Prisma.MusicTrackInclude;
