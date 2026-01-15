import { useFilterMutations } from '@/services/filter-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface Range {
  min: number;
  max: number;
}

export interface FilterState {
  genres: string[];
  subgenres: string[];
  keys: string[];
  tempo: Range;
  speechiness: Range;
  instrumentalness: Range;
  liveness: Range;
  acousticness: Range;
  artist: string;
  title: string;
  valenceMood: string[];
  arousalMood: string[];
  danceabilityFeeling: string[];
  libraryId: string[];
  atmospheres: string[];
}

export interface SavedFilterState {
  id: string | null;
  type: string | null;
  value: string | string[] | null;
  createdAt: string | null;
  isLoading: boolean;
  error: Error | null;
}

export interface FilterActions {
  // UI State Management
  updateFilter: <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => void;
  resetFilters: () => void;

  // Server Persistence
  saveCurrentFilter: (name?: string) => Promise<void>;
  loadSavedFilter: () => Promise<void>;
  clearSavedFilter: () => Promise<void>;

  // Utility
  hasActiveFilters: boolean;
}

const defaultFilterState: FilterState = {
  genres: [],
  subgenres: [],
  keys: [],
  tempo: { min: 0, max: 200 },
  valenceMood: [],
  arousalMood: [],
  danceabilityFeeling: [],
  speechiness: { min: 0, max: 1 },
  instrumentalness: { min: 0, max: 1 },
  liveness: { min: 0, max: 1 },
  acousticness: { min: 0, max: 1 },
  artist: '',
  title: '',
  libraryId: [],
  atmospheres: [],
};

export const useFiltering = () => {
  // UI State - immediate updates for filter controls
  const [filters, setFilters] = useState<FilterState>(defaultFilterState);

  // Server State - persistence and loading states
  const [savedFilterState, setSavedFilterState] = useState<SavedFilterState>({
    id: null,
    type: null,
    value: null,
    createdAt: null,
    isLoading: false,
    error: null,
  });

  // Server mutations
  const {
    setCurrentFilter: setCurrentFilterMutation,
    getCurrentFilter: getCurrentFilterQuery,
    clearCurrentFilter: clearCurrentFilterMutation,
  } = useFilterMutations();

  // UI State Actions
  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(defaultFilterState);
  }, []);

  // Server Actions
  const saveCurrentFilter = useCallback(
    async (name?: string) => {
      setSavedFilterState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const criteria = {
          genres: filters.genres,
          subgenres: filters.subgenres,
          keys: filters.keys,
          tempo: filters.tempo,
          valenceMood: filters.valenceMood,
          arousalMood: filters.arousalMood,
          danceabilityFeeling: filters.danceabilityFeeling,
          speechiness: filters.speechiness,
          instrumentalness: filters.instrumentalness,
          liveness: filters.liveness,
          acousticness: filters.acousticness,
          artist: filters.artist,
          title: filters.title,
          libraryId: filters.libraryId,
          atmospheres: filters.atmospheres,
        };

        const result = await setCurrentFilterMutation.mutateAsync(criteria);
        console.log('Filter saved:', result);

        setSavedFilterState((prev) => ({
          ...prev,
          id: name || 'current',
          type: 'music_filters',
          value: JSON.stringify(criteria),
          createdAt: new Date().toISOString(),
          isLoading: false,
        }));
      } catch (error) {
        setSavedFilterState((prev) => ({
          ...prev,
          error: error as Error,
          isLoading: false,
        }));
      }
    },
    [filters, setCurrentFilterMutation],
  );

  const loadSavedFilter = useCallback(async () => {
    setSavedFilterState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await getCurrentFilterQuery.refetch();
      if (result.data) {
        // Apply loaded filter to UI state
        const loadedFilters = result.data;
        setFilters({
          genres: loadedFilters.genres || [],
          subgenres: loadedFilters.subgenres || [],
          keys: loadedFilters.keys || [],
          tempo: loadedFilters.tempo || { min: 0, max: 200 },
          valenceMood: loadedFilters.valenceMood || [],
          arousalMood: loadedFilters.arousalMood || [],
          danceabilityFeeling: loadedFilters.danceabilityFeeling || [],
          speechiness: loadedFilters.speechiness || { min: 0, max: 1 },
          instrumentalness: loadedFilters.instrumentalness || {
            min: 0,
            max: 1,
          },
          liveness: loadedFilters.liveness || { min: 0, max: 1 },
          acousticness: loadedFilters.acousticness || { min: 0, max: 1 },
          artist: loadedFilters.artist || '',
          title: loadedFilters.title || '',
          libraryId: loadedFilters.libraryId || [],
          atmospheres: loadedFilters.atmospheres || [],
        });

        setSavedFilterState((prev) => ({
          ...prev,
          id: 'current',
          type: 'music_filters',
          value: JSON.stringify(result.data),
          createdAt: new Date().toISOString(),
          isLoading: false,
        }));
      }
    } catch (error) {
      setSavedFilterState((prev) => ({
        ...prev,
        error: error as Error,
        isLoading: false,
      }));
    }
  }, [getCurrentFilterQuery]);

  const clearSavedFilter = useCallback(async () => {
    setSavedFilterState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await clearCurrentFilterMutation.mutateAsync();
      console.log('Filter cleared:', result);

      // Also reset UI state
      setFilters(defaultFilterState);

      setSavedFilterState((prev) => ({
        ...prev,
        id: null,
        type: null,
        value: null,
        createdAt: null,
        isLoading: false,
      }));
    } catch (error) {
      setSavedFilterState((prev) => ({
        ...prev,
        error: error as Error,
        isLoading: false,
      }));
    }
  }, [clearCurrentFilterMutation]);

  // Computed values
  const hasActiveFilters = useMemo(() => {
    return (
      filters.genres.length > 0 ||
      filters.subgenres.length > 0 ||
      filters.keys.length > 0 ||
      filters.tempo.min !== 0 ||
      filters.tempo.max !== 200 ||
      filters.valenceMood.length > 0 ||
      filters.arousalMood.length > 0 ||
      filters.danceabilityFeeling.length > 0 ||
      filters.speechiness.min !== 0 ||
      filters.speechiness.max !== 1 ||
      filters.instrumentalness.min !== 0 ||
      filters.instrumentalness.max !== 1 ||
      filters.liveness.min !== 0 ||
      filters.liveness.max !== 1 ||
      filters.acousticness.min !== 0 ||
      filters.acousticness.max !== 1 ||
      filters.artist !== '' ||
      filters.title !== ''
    );
  }, [filters]);

  // Sync server state when query data changes
  useEffect(() => {
    if (getCurrentFilterQuery.data && !getCurrentFilterQuery.isLoading) {
      const newSavedState: SavedFilterState = {
        id: 'current',
        type: 'music_filters',
        value: JSON.stringify(getCurrentFilterQuery.data),
        createdAt: new Date().toISOString(),
        isLoading: false,
        error: null,
      };

      setSavedFilterState(newSavedState);
    }
  }, [getCurrentFilterQuery.data, getCurrentFilterQuery.isLoading]);

  const actions: FilterActions = useMemo(
    () => ({
      updateFilter,
      resetFilters,
      saveCurrentFilter,
      loadSavedFilter,
      clearSavedFilter,
      hasActiveFilters,
    }),
    [
      updateFilter,
      resetFilters,
      saveCurrentFilter,
      loadSavedFilter,
      clearSavedFilter,
      hasActiveFilters,
    ],
  );

  return {
    // UI State
    filters,

    // Server State
    savedFilter: savedFilterState,
    isLoading: savedFilterState.isLoading || getCurrentFilterQuery.isLoading,
    error: savedFilterState.error,

    // Actions
    actions,

    // Raw mutations for advanced usage
    mutations: {
      setCurrentFilter: setCurrentFilterMutation,
      getCurrentFilter: getCurrentFilterQuery,
      clearCurrentFilter: clearCurrentFilterMutation,
    },
  };
};
