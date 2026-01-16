import { SimpleMusicTrack } from '@/__generated__/types';
import { TrackList } from '@/components/track/track-list';
import { useFilters } from '@/contexts/filter-context';
import { FilterState } from '@/hooks/useFiltering';
import { useFilterOptionsData } from '@/hooks/useFilterOptions';
import { ExtendedColumnSort } from '@/types/data-table';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { z } from 'zod';

function MusicPage() {
  const { page, perPage, sort } = Route.useSearch();

  const staticFilterOptions = useFilterOptionsData();
  // Use URL state management for pagination and sorting

  const { filters, loadSavedFilter, saveCurrentFilter, updateFilter } =
    useFilters();

  useEffect(() => {
    void loadSavedFilter();
  }, []);

  const handleSaveFilter = async () => {
    try {
      await saveCurrentFilter();
    } catch (error) {
      console.error('Failed to save filter:', error);
    }
  };
  useEffect(() => {
    handleSaveFilter();
  }, [filters]);

  const handleFilterChange = (values: Record<any, any>) => {
    for (const [key, value] of Object.entries(values)) {
      const isString = typeof value === 'string';
      const isStringArray =
        Array.isArray(value) && value.every((v) => typeof v === 'string');
      const isMinMaxRange =
        Array.isArray(value) &&
        value.length === 2 &&
        value.every((v) => typeof v === 'number');
      if (isString) {
        updateFilter(key as keyof FilterState, value as string);
      } else if (isStringArray) {
        updateFilter(key as keyof FilterState, value as string[]);
      } else if (isMinMaxRange) {
        updateFilter(key as keyof FilterState, {
          min: value[0],
          max: value[1],
        });
      }
      if (value === null) {
        updateFilter(key as keyof FilterState, value);
      }
    }
  };

  const memoizedSort = useMemo(() => {
    return sort;
  }, [sort]);

  const memoizedFilters = useMemo(() => {
    return filters;
  }, [filters]);
  const memoizedStaticFilterOptions = useMemo(() => {
    return staticFilterOptions;
  }, [staticFilterOptions]);
  return (
    <TrackList
      page={page}
      perPage={perPage}
      sort={memoizedSort as ExtendedColumnSort<SimpleMusicTrack>[]}
      staticFilterOptions={memoizedStaticFilterOptions}
      filters={memoizedFilters}
      handleFilterChange={handleFilterChange}
    />
  );
}

const productSearchSchema = z.object({
  page: z.number().default(1),
  perPage: z.number().default(10),
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
    .default([{ id: 'fileCreatedAt', desc: false }]),
});
export const Route = createFileRoute('/music')({
  component: MusicPage,
  validateSearch: productSearchSchema,
});
