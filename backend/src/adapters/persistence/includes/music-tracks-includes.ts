// playlist-includes.ts
import { Prisma } from '@prisma/client';

export const trackGenresInclude = {
  genre: true,
} satisfies Prisma.TrackGenreInclude;

// Never pull imageSearches.imageData (cover-art bytes) into track queries -- it
// would bloat every list response. Select just what the mapper needs to decide
// whether a servable cover exists (imageMimeType is written iff imageData is).
export const imageSearchesLiteSelect = {
  id: true,
  imagePath: true,
  imageUrl: true,
  imageMimeType: true,
  source: true,
} satisfies Prisma.ImageSearchSelect;

export const musicTracksIncludes = {
  audioFingerprint: true,
  imageSearches: { select: imageSearchesLiteSelect },
  trackGenres: { include: { genre: true } },
  trackSubgenres: { include: { subgenre: true } },
} satisfies Prisma.MusicTrackInclude;
