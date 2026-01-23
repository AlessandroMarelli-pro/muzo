import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parse } from 'graphql';
import type {
  CreateLibraryInput,
  MusicLibrary,
  MusicTrack,
  MusicTrackByCategoriesGraphQl,
  MusicTrackListPaginated,
  SimpleMusicTrack,
  TrackRecommendation,
  UpdateLibraryInput,
  UpdatePreferencesInput,
  UserPreferencesGraphQl as UserPreferences,
} from '../__generated__/types';
import { gql, graffleClient } from './graffle-client';
import { simpleMusicTrackFragment } from './playlist-hooks';

// Define AnalysisStatus enum locally since it's not in the generated types
export type AnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Define LibraryScanStatus enum locally since it's not in the generated types
export type LibraryScanStatus =
  | 'IDLE'
  | 'SCANNING'
  | 'ANALYZING'
  | 'PAUSED'
  | 'ERROR';

// Define PlaybackSession locally since it's not in the generated types
export type PlaybackSession = {
  id: string;
  trackId: string;
  status: string;
  currentPosition: number;
  duration: number;
  volume: number;
  isShuffled: boolean;
  repeatMode: string;
  currentIndex: number;
  startedAt?: string;
  pausedAt?: string;
  track: MusicTrack;
};

// Query Keys
export const queryKeys = {
  libraries: ['libraries'] as const,
  library: (id: string) => ['libraries', id] as const,
  tracks: (libraryId?: string, status?: AnalysisStatus, isFavorite?: boolean) =>
    ['tracks', { libraryId, status }] as const,
  tracksList: (
    libraryId?: string,
    status?: AnalysisStatus,
    isFavorite?: boolean,
    limit?: number,
    offset?: number,
    orderBy?: string,
    orderDirection?: 'asc' | 'desc',
  ) =>
    [
      'tracksList',
      { libraryId, status, isFavorite, limit, offset, orderBy, orderDirection },
    ] as const,

  tracksByCategories: (category?: string, genre?: string) =>
    ['tracks', 'by-categories', { genre, category }] as const,
  searchTracks: (query: string, libraryId?: string) =>
    ['tracks', 'search', { query, libraryId }] as const,
  preferences: ['preferences'] as const,
  recentlyPlayed: (limit?: number) =>
    ['tracks', 'recently-played', { limit }] as const,

  currentPlayback: ['playback', 'current'] as const,
  staticFilters: ['static-filters'] as const,
  randomTrack: (id?: string, filterLiked?: boolean) =>
    ['tracks', 'random', { id, filterLiked }] as const,
  randomTrackWithStats: () => ['tracks', 'random-with-stats'] as const,
  trackRecommendations: (id?: string, criteria?: string) =>
    ['tracks', 'recommendations', { id, criteria }] as const,
};

// Library Queries
export const useLibraries = () => {
  return useQuery({
    queryKey: queryKeys.libraries,
    queryFn: async () => {
      const response = await graffleClient.request<{
        libraries: MusicLibrary[];
      }>(gql`
        query GetLibraries {
          libraries {
            id
            name
            rootPath
            totalTracks
            analyzedTracks
            pendingTracks
            failedTracks
            lastScanAt
            lastIncrementalScanAt
            scanStatus
            settings {
              autoScan
              scanInterval
              includeSubdirectories
              supportedFormats
              maxFileSize
            }
            createdAt
            updatedAt
          }
        }
      `);
      return response.libraries;
    },
  });
};

export const useLibrary = (id: string) => {
  return useQuery({
    queryKey: queryKeys.library(id),
    queryFn: async () => {
      const response = await graffleClient.request<{ library: MusicLibrary }>({
        document: parse(gql`
          query GetLibrary($id: ID!) {
            library(id: $id) {
              id
              name
              rootPath
              totalTracks
              analyzedTracks
              pendingTracks
              failedTracks
              lastScanAt
              lastIncrementalScanAt
              scanStatus
              settings {
                autoScan
                scanInterval
                includeSubdirectories
                supportedFormats
                maxFileSize
              }
              createdAt
              updatedAt
            }
          }
        `),
        variables: { id },
      });
      return response.library;
    },
    enabled: !!id,
  });
};

// Track Queries
export const useTracks = ({
  libraryId,
  status,
  isFavorite,
}: {
  libraryId?: string;
  status?: AnalysisStatus;
  isFavorite?: boolean;
}) => {
  return useQuery({
    queryKey: queryKeys.tracks(libraryId, status, isFavorite),
    queryFn: async () => {
      const response = await graffleClient.request<{
        tracks: SimpleMusicTrack[];
      }>(
        gql`
          ${simpleMusicTrackFragment}
          query GetTracks($options: TrackQueryOptions) {
            tracks(options: $options) {
              ...SimpleMusicTrackFragment
            }
          }
        `,
        { options: { libraryId, analysisStatus: status, isFavorite } },
      );
      return response.tracks;
    },
  });
};

export const useRandomTrack = (id?: string, filterLiked?: boolean) => {
  return useQuery({
    queryKey: queryKeys.randomTrack(id, filterLiked),
    queryFn: async () => {
      const response = await graffleClient.request<{
        randomTrack: SimpleMusicTrack;
      }>(
        gql`
          ${simpleMusicTrackFragment}
          query GetRandomTrack($id: String, $filterLiked: Boolean) {
            randomTrack(id: $id, filterLiked: $filterLiked) {
              ...SimpleMusicTrackFragment
            }
          }
        `,
        { id, filterLiked },
      );
      return response.randomTrack;
    },
  });
};

export const useRandomTrackWithStats = () => {
  return useQuery({
    queryKey: queryKeys.randomTrackWithStats(),
    queryFn: async () => {
      const response = await graffleClient.request<{
        randomTrackWithStats: {
          track: SimpleMusicTrack | null;
          likedCount: number;
          bangerCount: number;
          dislikedCount: number;
          remainingCount: number;
        };
      }>(
        gql`
          ${simpleMusicTrackFragment}
          query GetRandomTrackWithStats {
            randomTrackWithStats {
              track {
                ...SimpleMusicTrackFragment
              }
              likedCount
              bangerCount
              dislikedCount
              remainingCount
            }
          }
        `,
      );
      return response.randomTrackWithStats;
    },
  });
};

export const useTrackRecommendations = (id?: string, criteria?: string) => {
  return useQuery({
    enabled: !!id,
    queryKey: queryKeys.trackRecommendations(id, criteria),
    queryFn: async () => {
      const response = await graffleClient.request<{
        trackRecommendations: TrackRecommendation[];
      }>(
        gql`
          ${simpleMusicTrackFragment}
          query GetTrackRecommendations($id: String!, $criteria: String) {
            trackRecommendations(id: $id, criteria: $criteria) {
              track {
                ...SimpleMusicTrackFragment
              }
              similarity
              reasons
            }
          }
        `,
        { id, criteria },
      );
      return response.trackRecommendations;
    },
  });
};

export const useTracksList = ({
  libraryId,
  status,
  isFavorite,
  limit = 50,
  offset = 0,
  orderBy = 'createdAt',
  orderDirection = 'desc',
}: {
  libraryId?: string;
  status?: AnalysisStatus;
  isFavorite?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}) => {
  return useQuery({
    queryKey: queryKeys.tracksList(
      libraryId,
      status,
      isFavorite,
      limit,
      offset,
      orderBy,
      orderDirection,
    ),
    queryFn: async () => {
      const response = await graffleClient.request<{
        tracksList: MusicTrackListPaginated;
      }>(
        gql`
          ${simpleMusicTrackFragment}
          query GetTracksList($options: TrackQueryOptions) {
            tracksList(options: $options) {
              tracks {
                ...SimpleMusicTrackFragment
              }
              total
              page
              limit
            }
          }
        `,
        {
          options: {
            libraryId,
            analysisStatus: status,
            isFavorite,
            limit,
            offset,
            orderBy,
            orderDirection,
          },
        },
      );
      return response.tracksList;
    },
  });
};

export const useTracksByCategories = (category?: string, genre?: string) => {
  return useQuery({
    queryKey: queryKeys.tracksByCategories(category, genre),
    queryFn: async () => {
      const response = await graffleClient.request<{
        tracksByCategories: MusicTrackByCategoriesGraphQl[];
      }>(
        gql`
          ${simpleMusicTrackFragment}
          query GetTracksByCategories($options: TrackQueryOptionsByCategories) {
            tracksByCategories(options: $options) {
              category
              name
              trackCount
              tracks {
                ...SimpleMusicTrackFragment
              }
            }
          }
        `,
        { options: { category, genre } },
      );
      return response.tracksByCategories;
    },
  });
};

export const useSearchTracks = (query: string, libraryId?: string) => {
  return useQuery({
    queryKey: queryKeys.searchTracks(query, libraryId),
    queryFn: async () => {
      const response = await graffleClient.request<{
        searchTracks: MusicTrack[];
      }>(
        gql(
          `
          query SearchTracks($query: String!, $libraryId: ID) {
            searchTracks(query: $query, libraryId: $libraryId) {
              id
              filePath
              fileName
              fileSize
              duration
              format
              originalTitle
              originalArtist
              originalAlbum
              aiTitle
              aiArtist
              aiAlbum
              aiSubgenreConfidence
              aiConfidence
              userTitle
              userArtist
              userAlbum
              listeningCount
              analysisStatus
              libraryId
              audioFingerprint {
                tempo
                key
                energy
                valence
                danceability
              }
              imageSearches {
                id
                imagePath
                imageUrl
                source
              }
            }
          }
        ` as any,
        ),
        { query, libraryId },
      );
      return response.searchTracks;
    },
    enabled: !!query,
  });
};

// Preferences Queries
export const usePreferences = () => {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: async () => {
      const response = await graffleClient.request<{
        preferences: UserPreferences;
      }>(
        gql(
          `
          query GetPreferences {
            preferences {
              id
              userId
              analysisPreferences {
                autoAnalyze
                confidenceThreshold
                preferredGenres
                skipLowConfidence
              }
              organizationPreferences {
                autoOrganize
                organizationMethod
                createPlaylists
                exportToDJSoftware
              }
              editorPreferences {
                showConfidenceScores
                batchMode
                autoSave
                undoLevels
              }
              uiPreferences {
                theme
                language
                defaultView
              }
              createdAt
              updatedAt
            }
          }
        ` as any,
        ),
      );
      return response.preferences;
    },
  });
};

// Static Filters Query
export const useStaticFilters = () => {
  return useQuery({
    queryKey: queryKeys.staticFilters,
    queryFn: async () => {
      const response = await graffleClient.request<{
        getStaticFilterOptions: {
          genres: string[];
          subgenres: string[];
          keys: string[];
          libraries: { id: string; name: string }[];
          atmospheres: string[];
        };
      }>(gql`
        query GetStaticFilters {
          getStaticFilterOptions {
            genres
            subgenres
            keys
            libraries {
              id
              name
            }
            atmospheres
          }
        }
      `);
      return response.getStaticFilterOptions;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - static data doesn't change often
  });
};

// Playback Queries
export const useRecentlyPlayed = (limit = 20) => {
  return useQuery({
    queryKey: queryKeys.recentlyPlayed(limit),
    queryFn: async () => {
      const response = await graffleClient.request<{
        recentlyPlayed: SimpleMusicTrack[];
      }>(
        gql`
          ${simpleMusicTrackFragment}
          query GetRecentlyPlayed($limit: Float) {
            recentlyPlayed(limit: $limit) {
              ...SimpleMusicTrackFragment
            }
          }
        `,
        { limit },
      );
      return response.recentlyPlayed;
    },
  });
};

// Note: currentPlayback query removed as it doesn't exist in the schema
// export const useCurrentPlayback = () => { ... };

// Mutations
export const useCreateLibrary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLibraryInput) => {
      const response = await graffleClient.request<{
        createLibrary: MusicLibrary;
      }>(
        parse(
          `
          mutation CreateLibrary($input: CreateLibraryInput!) {
            createLibrary(input: $input) {
              id
              name
              rootPath
              totalTracks
              analyzedTracks
              pendingTracks
              failedTracks
              scanStatus
              settings {
                autoScan
                scanInterval
                includeSubdirectories
                supportedFormats
                maxFileSize
              }
              createdAt
              updatedAt
            }
          }
        `,
        ),
        { input },
      );
      return response.createLibrary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.libraries });
    },
  });
};

export const useUpdateLibrary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateLibraryInput;
    }) => {
      const response = await graffleClient.request<{
        updateLibrary: MusicLibrary;
      }>(
        gql(
          `
          mutation UpdateLibrary($id: ID!, $input: UpdateLibraryInput!) {
            updateLibrary(id: $id, input: $input) {
              id
              name
              rootPath
              totalTracks
              analyzedTracks
              pendingTracks
              failedTracks
              scanStatus
              settings {
                autoScan
                scanInterval
                includeSubdirectories
                supportedFormats
                maxFileSize
              }
              createdAt
              updatedAt
            }
          }
        ` as any,
        ),
        { id, input },
      );
      return response.updateLibrary;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.libraries });
      queryClient.invalidateQueries({ queryKey: queryKeys.library(data.id) });
    },
  });
};

export const useDeleteLibrary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await graffleClient.request<{ deleteLibrary: boolean }>(
        parse(
          `
          mutation DeleteLibrary($id: ID!) {
            deleteLibrary(id: $id)
          }
        ` as any,
        ),
        { id },
      );
      return response.deleteLibrary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.libraries });
    },
    onError: (error) => {
      console.error('Failed to delete library:', error);
    },
  });
};

export const useLikeTrack = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) => {
      const response = await graffleClient.request<{
        likeTrack: SimpleMusicTrack;
      }>(
        gql`
          ${simpleMusicTrackFragment}
          mutation LikeTrack($trackId: ID!) {
            likeTrack(trackId: $trackId) {
              ...SimpleMusicTrackFragment
            }
          }
        `,
        { trackId },
      );
      return response.likeTrack;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tracks() });
      queryClient.invalidateQueries({ queryKey: queryKeys.randomTrackWithStats() });
    },
  });
};

export const useBangerTrack = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) => {
      const response = await graffleClient.request<{
        bangerTrack: SimpleMusicTrack;
      }>(
        gql`
          ${simpleMusicTrackFragment}
          mutation BangerTrack($trackId: ID!) {
            bangerTrack(trackId: $trackId) {
              ...SimpleMusicTrackFragment
            }
          }
        `,
        { trackId },
      );
      return response.bangerTrack;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tracks() });
      queryClient.invalidateQueries({ queryKey: ['tracks', 'random-with-stats'] });
    },
  });
};

export const useDislikeTrack = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) => {
      const response = await graffleClient.request<{
        dislikeTrack: boolean;
      }>(
        gql`
          mutation DislikeTrack($trackId: ID!) {
            dislikeTrack(trackId: $trackId)
          }
        `,
        { trackId },
      );
      return response.dislikeTrack;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tracks() });
      queryClient.invalidateQueries({ queryKey: ['tracks', 'random-with-stats'] });
    },
  });
};

export const useUpdatePreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePreferencesInput) => {
      const response = await graffleClient.request<{
        updatePreferences: UserPreferences;
      }>(
        gql(
          `
          mutation UpdatePreferences($input: UpdatePreferencesInput!) {
            updatePreferences(input: $input) {
              id
              analysisPreferences {
                autoAnalyze
                confidenceThreshold
                preferredGenres
                skipLowConfidence
              }
              organizationPreferences {
                autoOrganize
                organizationMethod
                createPlaylists
                exportToDJSoftware
              }
              editorPreferences {
                showConfidenceScores
                batchMode
                autoSave
                undoLevels
              }
              uiPreferences {
                theme
                language
                defaultView
              }
              updatedAt
            }
          }
        ` as any,
        ),
        { input },
      );
      return response.updatePreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences });
    },
  });
};

// Note: playTrack mutation removed as it doesn't exist in the schema
// export const usePlayTrack = () => { ... };
