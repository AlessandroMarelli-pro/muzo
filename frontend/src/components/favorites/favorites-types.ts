import type { Track } from '@/__generated__/types';

/** A favorite is a playlist entry, so carry the join row's `addedAt` alongside. */
export type FavoriteTrack = Track & { addedAt?: string | null };

export type FavoritesSortKey = 'addedAt' | 'title' | 'mfTempo' | 'mfKey';
export type SortDirection = 'asc' | 'desc';
