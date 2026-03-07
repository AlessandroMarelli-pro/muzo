import { FilterCriteriaResult } from "@/__generated__/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toFilterState } from "./filter.mapper";
import { filterFragment } from "./fragments";
import { gql, graffleClient } from "./graffle-client";

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
  title?: string;
  libraryId?: string[];
}

export interface RangeInput {
  max?: number;
  min?: number;
}

// Query Keys
export const filterQueryKeys = {
  currentFilter: () => ["filter", "current"] as const,
};

// Queries
export const useActiveFilters = () => {
  return useQuery({
    queryKey: filterQueryKeys.currentFilter(),
    queryFn: async () => {
      const response = await graffleClient.request<{
        me: { activeFilters: FilterCriteriaResult[] };
      }>(gql`
        ${filterFragment}
        query ActiveFilters {
          me {
            activeFilters {
              ...FilterFragment
            }
          }
        }
      `);
      return response.me.activeFilters;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - static data doesn't change often
  });
};

export const useCurrentFilter = () => {
  return useQuery({
    queryKey: filterQueryKeys.currentFilter(),
    queryFn: async () => {
      const response = await graffleClient.request<{
        me: { currentFilter: FilterCriteriaResult };
      }>(gql`
        ${filterFragment}
        query GetCurrentFilter {
          me {
            currentFilter {
              ...FilterFragment
            }
          }
        }
      `);
      return toFilterState(response.me.currentFilter);
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - static data doesn't change often
  });
};
// Mutations
export const useCreateActiveFilter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (criteria: FilterCriteriaInput) => {
      const response = await graffleClient.request<{
        createSavedFilter: FilterCriteriaResult;
      }>(
        gql`
          ${filterFragment}
          mutation CreateFilter($input: SavedFilterInput!) {
            createSavedFilter(input: $input) {
              ...FilterFragment
            }
          }
        `,
        { input: { criteria, name: "current", isCurrent: true } },
      );
      return toFilterState(response.createSavedFilter);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(filterQueryKeys.currentFilter(), data);
      console.log("Filter set successfully:", data);

      // Invalidate all queries that depend on filters
      queryClient.invalidateQueries({ queryKey: ["music-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["playlistRecommendations"] });
      queryClient.invalidateQueries({ queryKey: ["tracksList"] });
    },
    onError: (error) => {
      console.error("Error setting filter:", error);
    },
  });
};
export const useUpdateActiveFilter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, criteria }: { id: string; criteria: FilterCriteriaInput }) => {
      const response = await graffleClient.request<{
        updateSavedFilter: FilterCriteriaResult;
      }>(
        gql`
          ${filterFragment}
          mutation UpdateFilter($id: Base64ID!, $input: SavedFilterInput!) {
            updateSavedFilter(id: $id, input: $input) {
              ...FilterFragment
            }
          }
        `,
        { input: { criteria, name: "current", isCurrent: true }, id },
      );
      return toFilterState(response.updateSavedFilter);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(filterQueryKeys.currentFilter(), data);
      console.log("Filter set successfully:", data);

      // Invalidate all queries that depend on filters
      queryClient.invalidateQueries({ queryKey: ["music-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["playlistRecommendations"] });
      queryClient.invalidateQueries({ queryKey: ["tracksList"] });
    },
    onError: (error) => {
      console.error("Error setting filter:", error);
    },
  });
};
export const useDeleteActiveFilter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await graffleClient.request<{
        deleteSavedFilter: boolean;
      }>(
        gql`
          mutation DeleteActiveFilter($id: Base64ID!) {
            deleteSavedFilter(id: $id)
          }
        `,
        { id },
      );
      return response.deleteSavedFilter;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(filterQueryKeys.currentFilter(), null);
      console.log("Filter cleared successfully:", data);

      // Invalidate all queries that depend on filters
      queryClient.invalidateQueries({ queryKey: ["music-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["playlistRecommendations"] });
    },
    onError: (error) => {
      console.error("Error clearing filter:", error);
    },
  });
};
