// playlist-includes.ts
import { Prisma } from '@prisma/client';
import type {
  PlaylistSortingDirection,
  PlaylistSortingKey,
} from 'src/kernel/types/model-types';

export type PlaylistWithTracksIncludeOptions = {
  sortingKey: PlaylistSortingKey;
  sortingDirection: PlaylistSortingDirection;
};

const trackInclude = {
  audioFingerprint: true,
  imageSearches: true,
  trackGenres: { include: { genre: true } },
  trackSubgenres: { include: { subgenre: true } },
  trackAiAtmosphereTags: { include: { aiAtmosphereTag: true } },
} satisfies Prisma.MusicTrackInclude;

export function playlistWithTracksInclude(
  sortingOpts: PlaylistWithTracksIncludeOptions,
) {
  const orderBy =
    sortingOpts.sortingKey === 'position'
      ? ({ position: sortingOpts.sortingDirection } as const)
      : ({ addedAt: sortingOpts.sortingDirection } as const);

  return Prisma.validator<Prisma.PlaylistInclude>()({
    sorting: true,
    tracks: {
      include: {
        track: {
          include: trackInclude,
        },
      },
      orderBy,
    },
  });
}
