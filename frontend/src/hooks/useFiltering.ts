import { FilterCriteriaInput } from '@/__generated__/types';
import {
  useCreateActiveFilter,
  useCurrentFilter,
  useDeleteActiveFilter,
  useUpdateActiveFilter,
} from '@/services/filter-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SAVE_DEBOUNCE_MS = 400;

export interface Range {
  min: number;
  max: number;
}

export interface FilterState {
  id?: string | null;
  genres: string[];
  subgenres: string[];
  keyIds: string[];
  library: string[];
  atmosphereIds: string[];
  tempo: Range;
  instrumentalness: Range;
  artist: string;
  title: string;
  valenceMood: string[];
  arousalMood: string[];
  danceabilityFeeling: string[];
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
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  updateFilters: (values: Record<string, any>) => void;
  resetFilters: () => void;

  // Utility
  hasActiveFilters: boolean;
}

export interface UseFilteringOptions {
  autoSave?: boolean;
  onSaveError?: (error: Error) => void;
}

const defaultFilterState: FilterState = {
  id: null,
  genres: [],
  subgenres: [],
  keyIds: [],
  tempo: { min: 0, max: 200 },
  valenceMood: [],
  arousalMood: [],
  danceabilityFeeling: [],
  instrumentalness: { min: 0, max: 1 },
  artist: '',
  title: '',
  library: [],
  atmosphereIds: [],
};

const toFilterCriteriaInput = (filters: FilterState): FilterCriteriaInput => {
  console.log('toFilterCriteriaInput', filters);
  return {
    genreIds: filters.genres,
    subgenreIds: filters.subgenres,
    keyIds: filters.keyIds,
    libraryIds: filters.library,
    atmosphereIds: filters.atmosphereIds,
    tempo: filters.tempo,
    valenceMood: filters.valenceMood,
    arousalMood: filters.arousalMood,
    danceabilityFeeling: filters.danceabilityFeeling,
    instrumentalness: filters.instrumentalness,
    artist: filters.artist,
    title: filters.title,
  };
};

export const useFiltering = (options: UseFilteringOptions = {}) => {
  const { autoSave = false } = options;
  const currentFilter = useCurrentFilter();
  const updateActiveFilter = useUpdateActiveFilter();
  const createActiveFilter = useCreateActiveFilter();
  const deleteActiveFilter = useDeleteActiveFilter();
  const [filters, setFilters] = useState<FilterState>(defaultFilterState);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetFilters = () => {
    console.log('resetFilters', filters.id);
    if (filters.id) {
      deleteActiveFilter.mutate(filters.id);
      setFilters(defaultFilterState);
      setIsDirty(false);
    }
  };

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setIsDirty(true);

    setFilters((prev) => ({
      ...prev,
      [key]: value ?? defaultFilterState[key],
    }));
  }, []);

  const updateFilters = useCallback(
    (values: Record<string, any>) => {
      for (const [key, value] of Object.entries(values)) {
        const isString = typeof value === 'string';
        const isStringArray = Array.isArray(value) && value.every((v) => typeof v === 'string');
        const isMinMaxRange =
          Array.isArray(value) && value.length === 2 && value.every((v) => !isNaN(Number(v)));

        if (value === null) {
          updateFilter(key as keyof FilterState, value);
        } else if (isMinMaxRange) {
          updateFilter(
            key as keyof FilterState,
            {
              min: Number(value[0]),
              max: Number(value[1]),
            } as Range,
          );
        } else if (isStringArray) {
          updateFilter(key as keyof FilterState, value as string[]);
        } else if (isString) {
          updateFilter(key as keyof FilterState, value as string);
        }
      }
    },
    [updateFilter],
  );

  useEffect(() => {
    if (currentFilter.data) {
      setFilters({
        ...currentFilter.data.criteria,
        id: currentFilter.data.id,
      });
    }
  }, [currentFilter.data]);

  useEffect(() => {
    if (!autoSave || currentFilter.isLoading || !isDirty) {
      return;
    }
    saveTimeoutRef.current = setTimeout(() => {
      const { id, ...criteria } = filters;

      if (id) {
        updateActiveFilter.mutate({
          id,
          criteria: toFilterCriteriaInput(filters),
        });
      } else {
        createActiveFilter.mutate(toFilterCriteriaInput(criteria));
      }
      setIsDirty(false);
      saveTimeoutRef.current = null;
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [autoSave, currentFilter.isLoading, isDirty, filters, updateActiveFilter, createActiveFilter]);

  // Computed values
  const hasActiveFilters = useMemo(() => {
    const areFiltersActive =
      filters.genres.length > 0 ||
      filters.subgenres.length > 0 ||
      filters.keyIds.length > 0 ||
      filters.tempo.min !== 0 ||
      filters.tempo.max !== 200 ||
      filters.valenceMood.length > 0 ||
      filters.arousalMood.length > 0 ||
      filters.danceabilityFeeling.length > 0 ||
      filters.instrumentalness.min !== 0 ||
      filters.instrumentalness.max !== 1 ||
      filters.artist !== '' ||
      filters.title !== '' ||
      filters.library.length > 0 ||
      filters.atmosphereIds.length > 0;

    return areFiltersActive;
  }, [filters]);

  const actions: FilterActions = useMemo(
    () => ({
      updateFilter,
      updateFilters,
      resetFilters,
      hasActiveFilters,
    }),
    [updateFilter, updateFilters, resetFilters, hasActiveFilters],
  );

  return {
    // UI State
    filters,

    // Actions
    actions,
  };
};
