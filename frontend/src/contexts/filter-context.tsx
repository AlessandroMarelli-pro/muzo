import { FilterState, useFiltering } from '@/hooks/useFiltering';
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export interface Range {
  min: number;
  max: number;
}

export interface FilterOptions {
  genres: { label: string; value: string }[];
  subgenres: { label: string; value: string }[];
  keys: { label: string; value: string }[];
  libraries: { label: string; value: string }[];
}

const FilterContext = createContext<{
  filters: FilterState;
  updateFilter: <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  // Server persistence actions
  saveCurrentFilter: (name?: string) => Promise<void>;
  loadSavedFilter: () => Promise<void>;
  clearSavedFilter: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} | null>(null);

const FilterOptionsContext = createContext<{
  options: FilterOptions;
  setOptions: (options: FilterOptions) => void;
} | null>(null);

interface FilterProviderProps {
  children: ReactNode;
}

export function FilterProvider({ children }: FilterProviderProps) {
  const [options, setOptions] = useState<FilterOptions>({
    genres: [],
    subgenres: [],
    keys: [],
    libraries: [],
  });

  const filtering = useFiltering();

  const filterValue = useMemo(
    () => ({
      filters: filtering.filters,
      updateFilter: filtering.actions.updateFilter,
      resetFilters: filtering.actions.resetFilters,
      hasActiveFilters: filtering.actions.hasActiveFilters,
      saveCurrentFilter: filtering.actions.saveCurrentFilter,
      loadSavedFilter: filtering.actions.loadSavedFilter,
      clearSavedFilter: filtering.actions.clearSavedFilter,
      isLoading: filtering.isLoading,
      error: filtering.error,
    }),
    [filtering],
  );

  const optionsValue = useMemo(
    () => ({
      options,
      setOptions,
    }),
    [options],
  );

  return (
    <FilterOptionsContext.Provider value={optionsValue}>
      <FilterContext.Provider value={filterValue}>
        {children}
      </FilterContext.Provider>
    </FilterOptionsContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}

export function useFilterOptions() {
  const context = useContext(FilterOptionsContext);
  if (!context) {
    throw new Error('useFilterOptions must be used within a FilterProvider');
  }
  return context;
}
