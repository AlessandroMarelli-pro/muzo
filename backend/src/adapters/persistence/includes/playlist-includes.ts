// playlist-includes.ts
import { Prisma } from '@prisma/client';
import type { PlaylistSortingDirection, PlaylistSortingKey } from 'src/kernel/types/model-types';

export type PlaylistWithTracksIncludeOptions = {
  sortingKey: PlaylistSortingKey;
  sortingDirection: PlaylistSortingDirection;
};

const trackInclude = {
  audioFingerprint: true,
  imageSearches: true,
  trackGenres: { include: { genre: true } },
  trackSubgenres: { include: { subgenre: true } },
} satisfies Prisma.MusicTrackInclude;

export function playlistWithTracksInclude(sortingOpts: PlaylistWithTracksIncludeOptions) {
  const orderBy =
    sortingOpts.sortingKey === 'position'
      ? ({ position: sortingOpts.sortingDirection } as const)
      : ({ addedAt: sortingOpts.sortingDirection } as const);

  return {
    sorting: true,
    tracks: {
      include: {
        track: {
          include: trackInclude,
        },
      },
      orderBy,
    },
  } satisfies Prisma.PlaylistInclude;
}
