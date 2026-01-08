import { StaticFilterOptions } from '@/__generated__/types';
import { useFilterOptions, useFilters } from '@/contexts/filter-context';
import { useStaticFilters } from '@/services/api-hooks';
import { useEffect } from 'react';

export type StaticFilterOptionsData = {
  [key in keyof StaticFilterOptions]: { label: string; value: string }[];
};

export function useFilterOptionsData(): StaticFilterOptionsData & {
  isLoading: boolean;
} {
  const { setOptions } = useFilterOptions();

  // Use the real API hook instead of mock data
  const { data: staticFiltersData, isLoading } = useStaticFilters();
  // Update filter options when data is loaded
  useEffect(() => {
    if (staticFiltersData) {
      setOptions({
        genres: staticFiltersData.genres.map((genre) => ({
          label: genre,
          value: genre,
        })),
        subgenres: staticFiltersData.subgenres.map((subgenre) => ({
          label: subgenre,
          value: subgenre,
        })),
        keys: staticFiltersData.keys.map((key) => ({
          label: key,
          value: key,
        })),
        libraries: staticFiltersData.libraries.map((library) => ({
          label: library.name,
          value: library.id,
        })),
        atmospheres: staticFiltersData.atmospheres.map((atmosphere) => ({
          label: atmosphere,
          value: atmosphere,
        })),
      });
    }
  }, [staticFiltersData, setOptions]);

  return {
    isLoading,
    genres:
      staticFiltersData?.genres.map((genre) => ({
        label: genre,
        value: genre,
      })) || [],
    subgenres:
      staticFiltersData?.subgenres.map((subgenre) => ({
        label: subgenre,
        value: subgenre,
      })) || [],
    keys:
      staticFiltersData?.keys.map((key) => ({
        label: key,
        value: key,
      })) || [],
    libraries:
      staticFiltersData?.libraries.map((library) => ({
        label: library.name,
        value: library.id,
      })) || [],
    atmospheres:
      staticFiltersData?.atmospheres.map((atmosphere) => ({
        label: atmosphere,
        value: atmosphere,
      })) || [],
  };
}

// Hook to apply filters to track queries
export function useFilteredTracksQuery(baseQuery: any) {
  const { filters } = useFilters();

  return {
    ...baseQuery,
    queryKey: [...baseQuery.queryKey, 'filtered', filters],
    // Add filter logic here when integrating with actual API
    // This would typically modify the query parameters
  };
}
