import { Track } from '@/__generated__/types';
import { TrackList } from '@/components/track/track-list';
import { useFilters } from '@/contexts/filter-context';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';
import { ExtendedColumnSort } from '@/types/data-table';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { z } from 'zod';

function MusicPage() {
  const { page, perPage, sort, view, review } = Route.useSearch();

  const staticFilterOptions = useFilterOptionsData();
  // Use URL state management for pagination and sorting

  const { filters, updateFilters } = useFilters();

  const memoizedSort = useMemo(() => {
    return sort;
  }, [sort]);
  const memoizedFilters = useMemo(() => {
    return filters;
  }, [filters]);
  const memoizedStaticFilterOptions = useMemo(() => {
    return staticFilterOptions;
  }, [staticFilterOptions]);

  const handleFilterChange = (values: Record<string, string | string[] | null>) => {
    updateFilters(values);
  };
  return (
    <TrackList
      page={page}
      perPage={perPage}
      sort={memoizedSort as ExtendedColumnSort<Track>[]}
      view={view}
      review={review}
      staticFilterOptions={memoizedStaticFilterOptions}
      filters={memoizedFilters}
      handleFilterChange={handleFilterChange}
    />
  );
}

const productSearchSchema = z.object({
  page: z.number().default(1),
  perPage: z.number().default(10),
  view: z.enum(['cards', 'table']).default('table'),
  /** Show only tracks that still need analysis (from the pending-tracks query). */
  review: z.boolean().default(false),
  // sort if of type sort=[{"id":"key","desc":false}]
  sort: z
    .array(
      z.object({
        id: z.enum([
          'title',
          'artist',
          'album',
          'duration',
          'createdAt',
          'listeningCount',
          'tempo',
          'danceabilityFeeling',
          'arousalMood',
          'valenceMood',
          'libraryId',
          'genre',
          'subgenre',
          'favorite',
          'lastPlayed',
          'lastScannedAt',
          'fileCreatedAt',
          'key',
        ]),
        desc: z.boolean(),
      }),
    )
    .default([{ id: 'fileCreatedAt', desc: true }]),
});
export const Route = createFileRoute('/music')({
  component: MusicPage,
  validateSearch: productSearchSchema,
});
