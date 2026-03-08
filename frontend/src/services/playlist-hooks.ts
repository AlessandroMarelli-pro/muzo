import {
  AddTrackToPlaylistInput,
  CreatePlaylistInput,
  Playlist,
  PlaylistSorting,
  PlaylistsResult,
  PlaylistTrack,
  TrackRecommendation,
} from '@/__generated__/types';
import { capitalizeEveryWord } from '@/lib/utils';
import { gql, graffleClient } from '@/services/graffle-client';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { playlistFragment, trackFragment } from './fragments';

// GraphQL Queries and Mutations
const GET_PLAYLISTS = gql`
  query GetPlaylists($verifyTrackId: Base64ID) {
    me {
      playlists {
        items {
          id
          name
          description
          createdAt
          updatedAt
          isPublic
          createdById
          stats {
            bpmRange {
              min
              max
            }
            energyRange {
              min
              max
            }
            genresCount
            numberOfTracks
            subgenresCount
            topGenres
            topSubgenres
            totalDuration
            images
          }
          containsTrack(trackId: $verifyTrackId)
        }
      }
    }
  }
`;

const GET_PLAYLIST = gql`
  ${playlistFragment}
  query GetPlaylist($id: Base64ID!) {
    node(id: $id) {
      ... on Playlist {
        ...PlaylistFragment
      }
    }
  }
`;

const GET_FAVORITE_PLAYLIST = gql`
  ${playlistFragment}
  query GetFavoritePlaylist {
    me {
      favorites {
        ...PlaylistFragment
      }
    }
  }
`;

const CREATE_PLAYLIST = gql`
  mutation CreatePlaylist($input: CreatePlaylistInput!) {
    createPlaylist(input: $input) {
      id
      name
      description
      createdAt
      updatedAt
    }
  }
`;

const DELETE_PLAYLIST = gql`
  mutation DeletePlaylist($id: Base64ID!) {
    deletePlaylist(id: $id)
  }
`;

const EXPORT_PLAYLIST_TO_M3U = gql`
  mutation ExportPlaylistToM3U($playlistId: Base64ID!) {
    exportPlaylistToM3U(playlistId: $playlistId)
  }
`;

const SYNC_PLAYLIST_TO_YOUTUBE = gql`
  mutation SyncPlaylistToYouTube($playlistId: ID!, $userId: String!) {
    syncPlaylistToYouTube(playlistId: $playlistId, userId: $userId) {
      success
      playlistId
      playlistUrl
      syncedCount
      skippedCount
      errors
    }
  }
`;

const GET_YOUTUBE_AUTH_URL = gql`
  query GetYouTubeAuthUrl {
    getYouTubeAuthUrl {
      authUrl
    }
  }
`;

const AUTHENTICATE_YOUTUBE = gql`
  mutation AuthenticateYouTube($code: String!, $userId: String!) {
    authenticateYouTube(code: $code, userId: $userId) {
      success
      message
    }
  }
`;

const SYNC_PLAYLIST_TO_TIDAL = gql`
  mutation SyncPlaylistToTidal($playlistId: ID!, $userId: String!) {
    syncPlaylistToTidal(playlistId: $playlistId, userId: $userId) {
      success
      playlistId
      playlistUrl
      syncedCount
      skippedCount
      errors
    }
  }
`;

const GET_TIDAL_AUTH_URL = gql`
  query GetTidalAuthUrl {
    getTidalAuthUrl {
      authUrl
      codeVerifier
    }
  }
`;

const AUTHENTICATE_TIDAL = gql`
  mutation AuthenticateTidal($code: String!, $codeVerifier: String!, $userId: String!) {
    authenticateTidal(code: $code, codeVerifier: $codeVerifier, userId: $userId) {
      success
      message
    }
  }
`;

const SYNC_PLAYLIST_TO_SPOTIFY = gql`
  mutation SyncPlaylistToSpotify($playlistId: ID!, $userId: String!) {
    syncPlaylistToSpotify(playlistId: $playlistId, userId: $userId) {
      success
      playlistId
      playlistUrl
      syncedCount
      skippedCount
      errors
    }
  }
`;

const GET_SPOTIFY_AUTH_URL = gql`
  query GetSpotifyAuthUrl {
    getSpotifyAuthUrl {
      authUrl
      codeVerifier
    }
  }
`;

const AUTHENTICATE_SPOTIFY = gql`
  mutation AuthenticateSpotify($code: String!, $codeVerifier: String!, $userId: String!) {
    authenticateSpotify(code: $code, codeVerifier: $codeVerifier, userId: $userId) {
      success
      message
    }
  }
`;

const ADD_TRACK_TO_PLAYLIST = gql`
  mutation AddTrackToPlaylist($playlistId: Base64ID!, $input: AddTrackToPlaylistInput!) {
    addTrackToPlaylist(playlistId: $playlistId, input: $input) {
      id
      position
      addedAt
    }
  }
`;

const REMOVE_TRACK_FROM_PLAYLIST = gql`
  mutation RemoveTrackFromPlaylist($playlistId: Base64ID!, $trackId: Base64ID!) {
    removeTrackFromPlaylist(playlistId: $playlistId, trackId: $trackId)
  }
`;

const GET_PLAYLIST_RECOMMENDATIONS = gql`
  ${trackFragment}
  query GetPlaylistRecommendations($playlistId: Base64ID!, $recommendationsLimit: Int) {
    node(id: $playlistId) {
      ... on Playlist {
        recommendations(limit: $recommendationsLimit) {
          track {
            ...TrackFragment
          }
          similarity
          reasons
        }
      }
    }
  }
`;

const UPDATE_PLAYLIST_POSITIONS = gql`
  mutation UpdatePlaylistPositions($playlistId: Base64ID!, $input: UpdatePlaylistPositionsInput!) {
    updatePlaylistTracksPositions(playlistId: $playlistId, input: $input)
  }
`;

const UPDATE_PLAYLIST_SORTING = gql`
  mutation UpdatePlaylistSorting($playlistId: Base64ID!, $input: UpdatePlaylistSortingInput!) {
    updatePlaylistSorting(playlistId: $playlistId, input: $input) {
      id
      playlistId
      sortingKey
      sortingDirection
      createdAt
      updatedAt
    }
  }
`;

const queryKeys = {
  playlists: (search?: string, verifyTrackId?: string) =>
    ['playlists', search, verifyTrackId] as const,
};

/** Query options for use in loaders with queryClient.ensureQueryData (dedupes preload + load). */
export const playlistsQueryOptions = (search?: string, verifyTrackId?: string) =>
  queryOptions({
    queryKey: queryKeys.playlists(search, verifyTrackId),
    queryFn: async () => await fetchPlaylists(search, verifyTrackId),
  });

export const favoritePlaylistQueryOptions = () =>
  queryOptions({
    queryKey: ['favoritePlaylist'] as const,
    queryFn: () => fetchFavoritePlaylist(),
  });

export const playlistRecommendationsQueryOptions = (playlistId: string, limit = 50) =>
  queryOptions({
    queryKey: ['playlistRecommendations', playlistId, limit] as const,
    queryFn: () => fetchPlaylistRecommendations(playlistId, limit),
  });

// API functions
export const fetchPlaylists = async (
  search?: string,
  verifyTrackId?: string,
): Promise<Playlist[]> => {
  return graffleClient
    .request<{
      me: { playlists: PlaylistsResult };
    }>(GET_PLAYLISTS, {
      search: search?.trim() || undefined,
      verifyTrackId,
    })
    .then((data) => data.me.playlists.items);
};

export const fetchPlaylist = async (id: string, userId: string = 'default'): Promise<Playlist> => {
  const data = await graffleClient.request<{ node: Playlist }>(GET_PLAYLIST, {
    id,
    userId,
  });
  return data.node;
};

export const fetchFavoritePlaylist = async (): Promise<Playlist> => {
  const data = await graffleClient.request<{
    me: { favorites: Playlist };
  }>(GET_FAVORITE_PLAYLIST);
  return data.me.favorites;
};

const createPlaylist = async (input: CreatePlaylistInput): Promise<Playlist> => {
  const data = await graffleClient.request<{
    createPlaylist: Playlist;
  }>(CREATE_PLAYLIST, { input });
  return data.createPlaylist;
};

const deletePlaylist = async (
  id: string,
  name: string,
): Promise<{ success: boolean; name: string }> => {
  const data = await graffleClient.request<{ deletePlaylist: boolean }>(DELETE_PLAYLIST, { id });
  return { success: data.deletePlaylist, name };
};

const exportPlaylistToM3U = async (playlistId: string): Promise<string> => {
  const data = await graffleClient.request<{ exportPlaylistToM3U: string }>(
    EXPORT_PLAYLIST_TO_M3U,
    { playlistId },
  );
  return data.exportPlaylistToM3U;
};

export interface SyncResult {
  success: boolean;
  playlistId?: string | null;
  playlistUrl?: string | null;
  syncedCount: number;
  skippedCount: number;
  errors: string[];
}

const syncPlaylistToYouTube = async (
  playlistId: string,
  userId: string = 'default',
): Promise<SyncResult> => {
  const data = await graffleClient.request<{
    syncPlaylistToYouTube: SyncResult;
  }>(SYNC_PLAYLIST_TO_YOUTUBE, { playlistId, userId });
  return data.syncPlaylistToYouTube;
};

const getYouTubeAuthUrl = async (): Promise<string> => {
  const data = await graffleClient.request<{
    getYouTubeAuthUrl: { authUrl: string };
  }>(GET_YOUTUBE_AUTH_URL);
  return data.getYouTubeAuthUrl.authUrl;
};

const authenticateYouTube = async (
  code: string,
  userId: string = 'default',
): Promise<{ success: boolean; message?: string }> => {
  const data = await graffleClient.request<{
    authenticateYouTube: { success: boolean; message?: string };
  }>(AUTHENTICATE_YOUTUBE, { code, userId });
  return data.authenticateYouTube;
};

const syncPlaylistToTidal = async (
  playlistId: string,
  userId: string = 'default',
): Promise<SyncResult> => {
  const data = await graffleClient.request<{
    syncPlaylistToTidal: SyncResult;
  }>(SYNC_PLAYLIST_TO_TIDAL, { playlistId, userId });
  return data.syncPlaylistToTidal;
};

const getTidalAuthUrl = async (): Promise<{
  authUrl: string;
  codeVerifier: string;
}> => {
  const data = await graffleClient.request<{
    getTidalAuthUrl: { authUrl: string; codeVerifier: string };
  }>(GET_TIDAL_AUTH_URL);
  return data.getTidalAuthUrl;
};

const authenticateTidal = async (
  code: string,
  codeVerifier: string,
  userId: string = 'default',
): Promise<{ success: boolean; message?: string }> => {
  const data = await graffleClient.request<{
    authenticateTidal: { success: boolean; message?: string };
  }>(AUTHENTICATE_TIDAL, { code, codeVerifier, userId });
  return data.authenticateTidal;
};

const syncPlaylistToSpotify = async (
  playlistId: string,
  userId: string = 'default',
): Promise<SyncResult> => {
  const data = await graffleClient.request<{
    syncPlaylistToSpotify: SyncResult;
  }>(SYNC_PLAYLIST_TO_SPOTIFY, { playlistId, userId });
  return data.syncPlaylistToSpotify;
};

const getSpotifyAuthUrl = async (): Promise<{
  authUrl: string;
  codeVerifier: string;
}> => {
  const data = await graffleClient.request<{
    getSpotifyAuthUrl: { authUrl: string; codeVerifier: string };
  }>(GET_SPOTIFY_AUTH_URL);
  return data.getSpotifyAuthUrl;
};

const authenticateSpotify = async (
  code: string,
  codeVerifier: string,
  userId: string = 'default',
): Promise<{ success: boolean; message?: string }> => {
  const data = await graffleClient.request<{
    authenticateSpotify: { success: boolean; message?: string };
  }>(AUTHENTICATE_SPOTIFY, { code, codeVerifier, userId });
  return data.authenticateSpotify;
};

const addTrackToPlaylist = async (
  playlistId: string,
  input: AddTrackToPlaylistInput,
  artist: string,
  title: string,
): Promise<PlaylistTrack> => {
  const data = await graffleClient.request<{
    addTrackToPlaylist: PlaylistTrack;
  }>(ADD_TRACK_TO_PLAYLIST, { playlistId, input });
  return {
    ...data.addTrackToPlaylist,
    track: {
      ...data.addTrackToPlaylist.track,
      artist,
      title,
    },
  };
};

const removeTrackFromPlaylist = async (
  playlistId: string,
  trackId: string,
  artist: string,
  title: string,
): Promise<{
  success: boolean;
  track: { id: string; artist: string; title: string };
}> => {
  const data = await graffleClient.request<{
    removeTrackFromPlaylist: boolean;
  }>(REMOVE_TRACK_FROM_PLAYLIST, { playlistId, trackId });
  return {
    success: data.removeTrackFromPlaylist,
    track: {
      id: trackId,
      artist,
      title,
    },
  };
};

export const fetchPlaylistRecommendations = async (
  playlistId: string,
  limit = 50,
  excludeTrackIds?: string[],
): Promise<TrackRecommendation[]> => {
  const data = await graffleClient.request<{
    node: {
      recommendations: TrackRecommendation[];
    };
  }>(GET_PLAYLIST_RECOMMENDATIONS, {
    playlistId,
    limit,
    excludeTrackIds,
  });
  return data.node.recommendations;
};

interface UpdatePlaylistPositionInput {
  id: string;
  position: number;
}

const updatePlaylistPositions = async (
  playlistId: string,
  positions: UpdatePlaylistPositionInput[],
): Promise<boolean> => {
  const input = {
    positions: positions.map((position) => ({
      id: position.id,
      position: position.position,
    })),
  };
  const data = await graffleClient.request<{
    updatePlaylistPositions: boolean;
  }>(UPDATE_PLAYLIST_POSITIONS, {
    playlistId,
    input,
  });
  return data.updatePlaylistPositions;
};

interface UpdatePlaylistSortingInput {
  sortingKey: 'position' | 'addedAt';
  sortingDirection: 'asc' | 'desc';
}

const updatePlaylistSorting = async (
  playlistId: string,
  input: UpdatePlaylistSortingInput,
): Promise<PlaylistSorting> => {
  const data = await graffleClient.request<{
    updatePlaylistSorting: PlaylistSorting;
  }>(UPDATE_PLAYLIST_SORTING, {
    playlistId,
    input,
  });
  return data.updatePlaylistSorting;
};

// Hooks
export function usePlaylists(search?: string, verifyTrackId?: string) {
  const queryClient = useQueryClient();

  const {
    data: playlists = [],
    isLoading: loading,
    error,
    refetch,
    isRefetching,
  } = useQuery<Playlist[]>({
    queryKey: playlistsQueryOptions(search, verifyTrackId).queryKey,
    queryFn: () => fetchPlaylists(search, verifyTrackId),
  });

  const createPlaylistMutation = useMutation({
    mutationFn: createPlaylist,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists(search, verifyTrackId),
      });
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => deletePlaylist(id, name),
    onSuccess: (_, { name }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists(search, verifyTrackId),
      });
      toast.success(`Playlist deleted successfully`, {
        description: capitalizeEveryWord(name),
      });
    },
  });

  const addTrackMutation = useMutation({
    mutationFn: ({
      playlistId,
      input,
      artist,
      title,
    }: {
      playlistId: string;
      input: AddTrackToPlaylistInput;
      artist: string;
      title: string;
    }) => addTrackToPlaylist(playlistId, input, artist, title),
    onSuccess: (data, { playlistId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists(search, verifyTrackId),
      });
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
      queryClient.invalidateQueries({
        queryKey: ['playlistRecommendations', playlistId, 50],
      });
      const trackName = ` ${data?.track?.title} by ${data?.track?.artist}`;
      toast.success(`Track added to playlist`, {
        description: capitalizeEveryWord(trackName),
      });
    },
  });

  const removeTrackMutation = useMutation({
    mutationFn: ({
      playlistId,
      trackId,
      artist,
      title,
    }: {
      playlistId: string;
      trackId: string;
      artist: string;
      title: string;
    }) => removeTrackFromPlaylist(playlistId, trackId, artist, title),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists(search, verifyTrackId),
      });
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    },
  });

  return {
    playlists,
    loading,
    error: error?.message,
    refetch,
    isRefetching,
    createPlaylist: createPlaylistMutation.mutateAsync,
    deletePlaylist: deletePlaylistMutation.mutateAsync,
    addTrackToPlaylist: (
      playlistId: string,
      input: AddTrackToPlaylistInput,
      artist: string,
      title: string,
    ) => addTrackMutation.mutateAsync({ playlistId, input, artist, title }),
    removeTrackFromPlaylist: (playlistId: string, trackId: string, artist: string, title: string) =>
      removeTrackMutation.mutateAsync({ playlistId, trackId, artist, title }),
  };
}

export function usePlaylist(id: string, userId: string = 'default') {
  const queryClient = useQueryClient();

  const syncToYouTubeMutation = useMutation({
    mutationFn: () => syncPlaylistToYouTube(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', id] });
    },
  });

  const syncToTidalMutation = useMutation({
    mutationFn: () => syncPlaylistToTidal(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', id] });
    },
  });

  const syncToSpotifyMutation = useMutation({
    mutationFn: () => syncPlaylistToSpotify(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', id] });
    },
  });

  return {
    syncToYouTube: syncToYouTubeMutation.mutateAsync,
    isSyncingToYouTube: syncToYouTubeMutation.isPending,
    syncToYouTubeError: syncToYouTubeMutation.error,
    syncToTidal: syncToTidalMutation.mutateAsync,
    isSyncingToTidal: syncToTidalMutation.isPending,
    syncToTidalError: syncToTidalMutation.error,
    syncToSpotify: syncToSpotifyMutation.mutateAsync,
    isSyncingToSpotify: syncToSpotifyMutation.isPending,
    syncToSpotifyError: syncToSpotifyMutation.error,
  };
}

export function useYouTubeAuth(userId: string = 'default') {
  const getAuthUrlMutation = useMutation({
    mutationFn: getYouTubeAuthUrl,
  });

  const authenticateMutation = useMutation({
    mutationFn: (code: string) => authenticateYouTube(code, userId),
  });

  return {
    getAuthUrl: getAuthUrlMutation.mutateAsync,
    authenticate: authenticateMutation.mutateAsync,
    isGettingAuthUrl: getAuthUrlMutation.isPending,
    isAuthenticating: authenticateMutation.isPending,
    authError: authenticateMutation.error,
  };
}

export function useTidalAuth(userId: string = 'default') {
  const getAuthUrlMutation = useMutation({
    mutationFn: getTidalAuthUrl,
  });

  const authenticateMutation = useMutation({
    mutationFn: ({ code, codeVerifier }: { code: string; codeVerifier: string }) =>
      authenticateTidal(code, codeVerifier, userId),
  });

  return {
    getAuthUrl: getAuthUrlMutation.mutateAsync,
    authenticate: authenticateMutation.mutateAsync,
    isGettingAuthUrl: getAuthUrlMutation.isPending,
    isAuthenticating: authenticateMutation.isPending,
    authError: authenticateMutation.error,
  };
}

export function useSpotifyAuth(userId: string = 'default') {
  const getAuthUrlMutation = useMutation({
    mutationFn: getSpotifyAuthUrl,
  });

  const authenticateMutation = useMutation({
    mutationFn: ({ code, codeVerifier }: { code: string; codeVerifier: string }) =>
      authenticateSpotify(code, codeVerifier, userId),
  });

  return {
    getAuthUrl: getAuthUrlMutation.mutateAsync,
    authenticate: authenticateMutation.mutateAsync,
    isGettingAuthUrl: getAuthUrlMutation.isPending,
    isAuthenticating: authenticateMutation.isPending,
    authError: authenticateMutation.error,
  };
}

export function useFavoritePlaylist() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['favoritePlaylist'],
    queryFn: () => fetchFavoritePlaylist(),
  });
  return {
    playlist: data,
    isLoading,
    error: error?.message,
    refetch,
  };
}
export function useCreatePlaylist() {
  const queryClient = useQueryClient();

  const createPlaylistMutation = useMutation({
    mutationFn: createPlaylist,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: playlistsQueryOptions().queryKey,
      });
      // Ensure the playlists query has refetched and cache is updated
      await queryClient.refetchQueries({
        queryKey: playlistsQueryOptions().queryKey,
      });

      toast.success(`Playlist created successfully`, {
        description: data.name,
      });
    },
  });
  return {
    createPlaylist: createPlaylistMutation.mutateAsync,
  };
}

export function useDeletePlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      await deletePlaylist(id, name),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: playlistsQueryOptions().queryKey,
      });
      // Ensure the playlists query has refetched and cache is updated
      await queryClient.refetchQueries({
        queryKey: playlistsQueryOptions().queryKey,
      });

      toast.success(`Playlist deleted successfully`, {
        description: data.name,
      });
      return data;
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.errors?.[0]?.message || error?.message || 'Failed to delete playlist';
      console.error(errorMessage);
      toast.error(errorMessage, {
        duration: 3000,
      });
    },
  });
}

export function useExportPlaylistToM3U() {
  return useMutation({
    mutationFn: (playlistId: string) => exportPlaylistToM3U(playlistId),
  });
}

export function useAddTrackToPlaylist(userId: string = 'default') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      playlistId,
      input,
      artist,
      title,
    }: {
      playlistId: string;
      input: AddTrackToPlaylistInput;
      artist: string;
      title: string;
    }) => addTrackToPlaylist(playlistId, input, artist, title),
    onSuccess: async (data, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      await queryClient.invalidateQueries({
        queryKey: playlistsQueryOptions(undefined, undefined).queryKey,
      });
      // Ensure the playlists query has refetched and cache is updated
      await queryClient.refetchQueries({
        queryKey: playlistsQueryOptions(undefined, undefined).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: ['playlist', playlistId, userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['playlistRecommendations', playlistId, 50],
      });
      const trackName = ` ${data?.track?.title} by ${data?.track?.artist}`;
      toast.success(`Track added to playlist`, {
        description: capitalizeEveryWord(trackName),
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.errors?.[0]?.message ||
        error?.message ||
        'Failed to add track to playlist';
      console.error(errorMessage);
      toast.error(errorMessage, {
        duration: 3000,
      });
    },
  });
}

export function useRemoveTrackFromPlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      playlistId,
      trackId,
      artist,
      title,
    }: {
      playlistId: string;
      trackId: string;
      artist: string;
      title: string;
    }) => removeTrackFromPlaylist(playlistId, trackId, artist, title),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    },
  });
}

export function usePlaylistRecommendations(
  playlistId: string,
  limit = 50,
  excludeTrackIds?: string[],
) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['playlistRecommendations', playlistId, limit],
    queryFn: () => fetchPlaylistRecommendations(playlistId, limit, excludeTrackIds),
    enabled: !!playlistId,
    staleTime: 5 * 60 * 1000, // 5 minutes - recommendations can change
  });
  return {
    data: data || [],
    isLoading,
    error,
    refetch,
  };
}

export function useUpdatePlaylistPositions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      playlistId,
      positions,
    }: {
      playlistId: string;
      positions: UpdatePlaylistPositionInput[];
    }) => updatePlaylistPositions(playlistId, positions),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
      toast.success('Playlist positions updated successfully');
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.errors?.[0]?.message ||
        error?.message ||
        'Failed to update playlist positions';
      console.error(errorMessage);
    },
  });
}

export function useUpdatePlaylistSorting(_userId: string = 'default') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      playlistId,
      input,
    }: {
      playlistId: string;
      input: UpdatePlaylistSortingInput;
    }) => updatePlaylistSorting(playlistId, input),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.errors?.[0]?.message ||
        error?.message ||
        'Failed to update playlist sorting';
      console.error(errorMessage);
    },
  });
}
