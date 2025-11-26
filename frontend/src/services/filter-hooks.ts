import { FilterCriteriaType } from '@/__generated__/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gql, graffleClient } from './graffle-client';

// Filter Types

export interface Range {
  max: number;
  min: number;
}

export interface FilterCriteriaInput {
  danceability?: RangeInput;
  energy?: RangeInput;
  genres?: string[];
  keys?: string[];
  subgenres?: string[];
  tempo?: RangeInput;
  valence?: RangeInput;
  speechiness?: RangeInput;
  instrumentalness?: RangeInput;
  liveness?: RangeInput;
  acousticness?: RangeInput;
  artist?: string;
}

export interface RangeInput {
  max?: number;
  min?: number;
}

// Query Keys
export const filterQueryKeys = {
  currentFilter: () => ['filter', 'current'] as const,
};

// Queries
export const useCurrentFilter = () => {
  return useQuery({
    queryKey: filterQueryKeys.currentFilter(),
    queryFn: async () => {
      const response = await graffleClient.request<{
        getCurrentFilter: FilterCriteriaType | null;
      }>(gql`
        query GetCurrentFilter {
          getCurrentFilter {
            valenceMood
            arousalMood
            danceabilityFeeling
            genres
            keys
            subgenres
            tempo {
              max
              min
            }
            speechiness {
              max
              min
            }
            instrumentalness {
              max
              min
            }
            liveness {
              max
              min
            }
            acousticness {
              max
              min
            }
            artist
          }
        }
      `);
      return response.getCurrentFilter;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - static data doesn't change often
  });
};

// Mutations
export const useSetCurrentFilter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (criteria: FilterCriteriaInput) => {
      const response = await graffleClient.request<{
        setCurrentFilter: FilterCriteriaType;
      }>(
        gql`
          mutation SetCurrentFilter($criteria: FilterCriteriaInput!) {
            setCurrentFilter(criteria: $criteria) {
              valenceMood
              arousalMood
              danceabilityFeeling
              genres
              keys
              subgenres
              tempo {
                max
                min
              }
              speechiness {
                max
                min
              }
              instrumentalness {
                max
                min
              }
              liveness {
                max
                min
              }
              acousticness {
                max
                min
              }
              artist
            }
          }
        `,
        { criteria },
      );
      return response.setCurrentFilter;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(filterQueryKeys.currentFilter(), data);
      console.log('Filter set successfully:', data);

      // Invalidate all queries that depend on filters
      queryClient.invalidateQueries({ queryKey: ['music-tracks'] });
      queryClient.invalidateQueries({ queryKey: ['tracksByCategories'] });
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      queryClient.invalidateQueries({ queryKey: ['playlistRecommendations'] });
      queryClient.invalidateQueries({ queryKey: ['tracksList'] });
    },
    onError: (error) => {
      console.error('Error setting filter:', error);
    },
  });
};

export const useClearCurrentFilter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await graffleClient.request<{
        clearCurrentFilter: boolean;
      }>(gql`
        mutation ClearCurrentFilter {
          clearCurrentFilter
        }
      `);
      return response.clearCurrentFilter;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(filterQueryKeys.currentFilter(), null);
      console.log('Filter cleared successfully:', data);

      // Invalidate all queries that depend on filters
      queryClient.invalidateQueries({ queryKey: ['music-tracks'] });
      queryClient.invalidateQueries({ queryKey: ['tracksByCategories'] });
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      queryClient.invalidateQueries({ queryKey: ['playlistRecommendations'] });
    },
    onError: (error) => {
      console.error('Error clearing filter:', error);
    },
  });
};

// Additional utility hooks for filter options
export const useFilterOptions = () => {
  return useQuery({
    queryKey: ['filter', 'options'],
    queryFn: async () => {
      const response = await graffleClient.request<{
        getFilterOptions: {
          tempoRange: Range;
        };
      }>(gql`
        query GetFilterOptions {
          getFilterOptions {
            tempoRange {
              max
              min
            }
          }
        }
      `);
      return response.getFilterOptions;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - filter options don't change often
  });
};

export const useStaticFilterOptions = () => {
  return useQuery({
    queryKey: ['filter', 'static-options'],
    queryFn: async () => {
      const response = await graffleClient.request<{
        getStaticFilterOptions: {
          genres: string[];
          keys: string[];
          subgenres: string[];
        };
      }>(gql`
        query GetStaticFilterOptions {
          getStaticFilterOptions {
            genres
            keys
            subgenres
          }
        }
      `);
      return response.getStaticFilterOptions;
    },
    staleTime: 60 * 60 * 1000, // 1 hour - static options rarely change
  });
};

// Saved filters hooks
export const useSavedFilters = () => {
  return useQuery({
    queryKey: ['saved-filters'],
    queryFn: async () => {
      const response = await graffleClient.request<{
        getSavedFilters: Array<{
          id: string;
          name: string;
          criteria: FilterCriteriaType;
          createdAt: string;
          updatedAt: string;
        }>;
      }>(gql`
        query GetSavedFilters {
          getSavedFilters {
            id
            name
            criteria {
              valenceMood
              arousalMood
              danceabilityFeeling
              genres
              keys
              subgenres
              tempo {
                max
                min
              }
              speechiness {
                max
                min
              }
              instrumentalness {
                max
                min
              }
              liveness {
                max
                min
              }
              acousticness {
                max
                min
              }
              artist
            }
            createdAt
            updatedAt
          }
        }
      `);
      return response.getSavedFilters;
    },
  });
};

export const useCreateSavedFilter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      criteria: FilterCriteriaInput;
    }) => {
      const response = await graffleClient.request<{
        createSavedFilter: {
          id: string;
          name: string;
          criteria: FilterCriteriaType;
          createdAt: string;
          updatedAt: string;
        };
      }>(
        gql`
          mutation CreateSavedFilter($input: CreateSavedFilterInput!) {
            createSavedFilter(input: $input) {
              id
              name
              criteria {
                valenceMood
                arousalMood
                danceabilityFeeling
                genres
                keys
                subgenres
                tempo {
                  max
                  min
                }
                speechiness {
                  max
                  min
                }
                instrumentalness {
                  max
                  min
                }
                liveness {
                  max
                  min
                }
                acousticness {
                  max
                  min
                }
                artist
              }
              createdAt
              updatedAt
            }
          }
        `,
        { input },
      );
      return response.createSavedFilter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
    },
  });
};

export const useDeleteSavedFilter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await graffleClient.request<{
        deleteSavedFilter: boolean;
      }>(
        gql`
          mutation DeleteSavedFilter($id: ID!) {
            deleteSavedFilter(id: $id)
          }
        `,
        { id },
      );
      return response.deleteSavedFilter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
    },
  });
};

// Combined hook for all filter mutations
export const useFilterMutations = () => {
  const setCurrentFilter = useSetCurrentFilter();
  const clearCurrentFilter = useClearCurrentFilter();
  const getCurrentFilter = useCurrentFilter();

  return {
    setCurrentFilter,
    clearCurrentFilter,
    getCurrentFilter,
  };
};

// Combined hook for all filter operations
export const useFilterOperations = () => {
  const mutations = useFilterMutations();
  const filterOptions = useFilterOptions();
  const staticOptions = useStaticFilterOptions();
  const savedFilters = useSavedFilters();
  const createSavedFilter = useCreateSavedFilter();
  const deleteSavedFilter = useDeleteSavedFilter();

  return {
    ...mutations,
    filterOptions,
    staticOptions,
    savedFilters,
    createSavedFilter,
    deleteSavedFilter,
  };
};
