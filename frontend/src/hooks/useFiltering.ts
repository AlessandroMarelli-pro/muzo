import { useFilterMutations } from '@/services/filter-hooks';
import { deepEqual } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  updateFilters: (values: Record<string, any>) => void;
  resetFilters: () => void;

  // Server Persistence
  saveCurrentFilter: (name?: string) => Promise<void>;
  loadSavedFilter: () => Promise<void>;
  clearSavedFilter: () => Promise<void>;

  // Utility
  hasActiveFilters: boolean;
}

export interface UseFilteringOptions {
  autoSave?: boolean;
  onSaveError?: (error: Error) => void;
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

export const useFiltering = (options: UseFilteringOptions = {}) => {
  const { autoSave = false, onSaveError } = options;

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

  // Refs to prevent infinite loops
  const isInitialMount = useRef(true);
  const isLoadingFromServer = useRef(false);
  const saveCurrentFilterRef = useRef<
    ((name?: string) => Promise<void>) | null
  >(null);

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
        [key]: value ?? defaultFilterState[key],
      }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(defaultFilterState);
  }, []);

  const updateFilters = useCallback(
    (values: Record<string, any>) => {
      for (const [key, value] of Object.entries(values)) {
        const isString = typeof value === 'string';
        const isStringArray =
          Array.isArray(value) && value.every((v) => typeof v === 'string');
        const isMinMaxRange =
          Array.isArray(value) &&
          value.length === 2 &&
          value.every((v) => typeof v === 'number');

        if (value === null) {
          updateFilter(key as keyof FilterState, value);
        } else if (isString) {
          updateFilter(key as keyof FilterState, value as string);
        } else if (isStringArray) {
          updateFilter(key as keyof FilterState, value as string[]);
        } else if (isMinMaxRange) {
          updateFilter(
            key as keyof FilterState,
            {
              min: value[0],
              max: value[1],
            } as Range,
          );
        }
      }
    },
    [updateFilter],
  );

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
        // Compare saved filter state value with criteria
        // savedFilterState.value is a json string, so we need to parse it and compare the values
        const savedFilterStateValue = JSON.parse(savedFilterState.value as string);
        const areFiltersEqual = deepEqual(savedFilterStateValue, criteria);
        if (areFiltersEqual) {
          setSavedFilterState((prev) => ({
            ...prev,
            isLoading: false,
          }));
          console.log('Filters are equal, skipping save');
          return;
        }

        await setCurrentFilterMutation.mutateAsync(criteria);

        setSavedFilterState((prev) => ({
          ...prev,
          id: name || 'current',
          type: 'music_filters',
          value: JSON.stringify(criteria),
          createdAt: new Date().toISOString(),
          isLoading: false,
        }));
      } catch (error) {
        const errorObj = error as Error;
        setSavedFilterState((prev) => ({
          ...prev,
          error: errorObj,
          isLoading: false,
        }));

        if (onSaveError) {
          onSaveError(errorObj);
        } else {
          console.error('Failed to save filter:', errorObj);
        }
      }
    },
    [filters, setCurrentFilterMutation, onSaveError],
  );

  // Store the latest saveCurrentFilter in ref for auto-save effect
  saveCurrentFilterRef.current = saveCurrentFilter;

  const loadSavedFilter = useCallback(async () => {
    setSavedFilterState((prev) => ({ ...prev, isLoading: true, error: null }));
    isLoadingFromServer.current = true;

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
    } finally {
      // Flag will be reset in the auto-save effect after it checks it
      // This ensures the effect has a chance to see the flag before it's reset
    }
  }, [getCurrentFilterQuery]);

  const clearSavedFilter = useCallback(async () => {
    setSavedFilterState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await clearCurrentFilterMutation.mutateAsync();

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
    const areFiltersActive =
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
      filters.title !== '' ||
      filters.libraryId.length > 0 ||
      filters.atmospheres.length > 0;

    return areFiltersActive;
  }, [filters]);

  // Auto-save filters when they change (if enabled)
  useEffect(() => {
    // Skip auto-save on initial mount (filters are loaded from server)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Skip auto-save when loading filters from server
    if (isLoadingFromServer.current) {
      // Reset the flag after this effect has run
      requestAnimationFrame(() => {
        isLoadingFromServer.current = false;
      });
      return;
    }

    if (autoSave && saveCurrentFilterRef.current) {
      console.log('Auto-saving filter');
      void saveCurrentFilterRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, autoSave]);

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
      updateFilters,
      resetFilters,
      saveCurrentFilter,
      loadSavedFilter,
      clearSavedFilter,
      hasActiveFilters,
    }),
    [
      updateFilter,
      updateFilters,
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
