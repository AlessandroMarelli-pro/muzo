import {
  AddTrackToPlaylistInput,
  CreatePlaylistInput,
  Playlist,
  PlaylistItem,
  PlaylistTrack,
  TrackRecommendation,
  UpdatePlaylistInput,
} from '@/__generated__/types';
import { gql, graffleClient } from '@/services/graffle-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const simpleMusicTrackFragment = gql`
  fragment SimpleMusicTrackFragment on SimpleMusicTrack {
    id
    artist
    format
    title
    duration
    genres
    subgenres
    date
    listeningCount
    lastPlayedAt
    isFavorite
    isLiked
    isBanger
    createdAt
    updatedAt
    tempo
    key
    valenceMood
    arousalMood
    danceabilityFeeling
    imagePath
    lastScannedAt
    fileCreatedAt
    description
    tags
    vocalsDescriptions
    atmosphereKeywords
    contextBackgrounds
    contextImpacts
    libraryId
  }
`;

// GraphQL Queries and Mutations
const GET_PLAYLISTS = gql`
  query GetPlaylists($userId: String!) {
    playlists(userId: $userId) {
      id
      name
      description
      bpmRange {
        min
        max
      }
      energyRange {
        min
        max
      }
      genresCount
      subgenresCount
      topGenres
      topSubgenres
      numberOfTracks
      totalDuration
      createdAt
      updatedAt
      images
    }
  }
`;

const GET_PLAYLIST = gql`
  ${simpleMusicTrackFragment}
  query GetPlaylist($id: ID!, $userId: String!) {
    playlist(id: $id, userId: $userId) {
      id
      name
      description
      bpmRange {
        min
        max
      }
      energyRange {
        min
        max
      }
      genresCount
      subgenresCount
      topGenres
      topSubgenres
      numberOfTracks
      totalDuration
      createdAt
      updatedAt
      images
      tracks {
        id
        position
        addedAt
        track {
          ...SimpleMusicTrackFragment
        }
      }
    }
  }
`;

const GET_PLAYLIST_BY_NAME = gql`
  ${simpleMusicTrackFragment}
  query GetPlaylistByName($name: String!) {
    playlistByName(name: $name) {
      id
      name
      description
      bpmRange {
        min
        max
      }
      energyRange {
        min
        max
      }
      genresCount
      subgenresCount
      topGenres
      topSubgenres
      numberOfTracks
      totalDuration
      createdAt
      updatedAt
      images
      tracks {
        id
        position
        addedAt
        track {
          ...SimpleMusicTrackFragment
        }
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

const UPDATE_PLAYLIST = gql`
  mutation UpdatePlaylist(
    $id: ID!
    $input: UpdatePlaylistInput!
    $userId: String!
  ) {
    updatePlaylist(id: $id, input: $input, userId: $userId) {
      id
      name
      description
      createdAt
      updatedAt
    }
  }
`;

const DELETE_PLAYLIST = gql`
  mutation DeletePlaylist($id: ID!, $userId: String!) {
    deletePlaylist(id: $id, userId: $userId)
  }
`;

const EXPORT_PLAYLIST_TO_M3U = gql`
  mutation ExportPlaylistToM3U($playlistId: ID!, $userId: String!) {
    exportPlaylistToM3U(playlistId: $playlistId, userId: $userId)
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
  mutation AuthenticateTidal(
    $code: String!
    $codeVerifier: String!
    $userId: String!
  ) {
    authenticateTidal(
      code: $code
      codeVerifier: $codeVerifier
      userId: $userId
    ) {
      success
      message
    }
  }
`;

const ADD_TRACK_TO_PLAYLIST = gql`
  ${simpleMusicTrackFragment}
  mutation AddTrackToPlaylist(
    $playlistId: ID!
    $input: AddTrackToPlaylistInput!
    $userId: String!
  ) {
    addTrackToPlaylist(
      playlistId: $playlistId
      input: $input
      userId: $userId
    ) {
      id
      position
      addedAt
      track {
        ...SimpleMusicTrackFragment
      }
    }
  }
`;

const REMOVE_TRACK_FROM_PLAYLIST = gql`
  mutation RemoveTrackFromPlaylist(
    $playlistId: ID!
    $trackId: ID!
    $userId: String!
  ) {
    removeTrackFromPlaylist(
      playlistId: $playlistId
      trackId: $trackId
      userId: $userId
    )
  }
`;

const GET_PLAYLIST_RECOMMENDATIONS = gql`
  ${simpleMusicTrackFragment}
  query GetPlaylistRecommendations(
    $playlistId: ID!
    $limit: Int
    $excludeTrackIds: [String!]
  ) {
    playlistRecommendations(
      playlistId: $playlistId
      limit: $limit
      excludeTrackIds: $excludeTrackIds
    ) {
      track {
        ...SimpleMusicTrackFragment
      }
      similarity
      reasons
    }
  }
`;

// API functions
const fetchPlaylists = async (
  userId: string = 'default',
): Promise<PlaylistItem[]> => {
  const data = await graffleClient.request<{ playlists: PlaylistItem[] }>(
    GET_PLAYLISTS,
    { userId },
  );
  return data.playlists;
};

const fetchPlaylist = async (
  id: string,
  userId: string = 'default',
): Promise<Playlist> => {
  const data = await graffleClient.request<{ playlist: Playlist }>(
    GET_PLAYLIST,
    { id, userId },
  );
  return data.playlist;
};

const fetchPlaylistByName = async (
  name: string,
  userId: string = 'default',
): Promise<Playlist> => {
  const data = await graffleClient.request<{ playlistByName: Playlist }>(
    GET_PLAYLIST_BY_NAME,
    { name, userId },
  );
  return data.playlistByName;
};

const createPlaylist = async (
  input: CreatePlaylistInput,
): Promise<Playlist> => {
  const data = await graffleClient.request<{ createPlaylist: Playlist }>(
    CREATE_PLAYLIST,
    { input },
  );
  return data.createPlaylist;
};

const updatePlaylist = async (
  id: string,
  input: UpdatePlaylistInput,
  userId: string = 'default',
): Promise<Playlist> => {
  const data = await graffleClient.request<{ updatePlaylist: Playlist }>(
    UPDATE_PLAYLIST,
    { id, input, userId },
  );
  return data.updatePlaylist;
};

const deletePlaylist = async (
  id: string,
  userId: string = 'default',
): Promise<boolean> => {
  const data = await graffleClient.request<{ deletePlaylist: boolean }>(
    DELETE_PLAYLIST,
    { id, userId },
  );
  return data.deletePlaylist;
};

const exportPlaylistToM3U = async (
  playlistId: string,
  userId: string = 'default',
): Promise<string> => {
  const data = await graffleClient.request<{ exportPlaylistToM3U: string }>(
    EXPORT_PLAYLIST_TO_M3U,
    { playlistId, userId },
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

const addTrackToPlaylist = async (
  playlistId: string,
  input: AddTrackToPlaylistInput,
  userId: string = 'default',
): Promise<PlaylistTrack> => {
  const data = await graffleClient.request<{
    addTrackToPlaylist: PlaylistTrack;
  }>(ADD_TRACK_TO_PLAYLIST, { playlistId, input, userId });
  return data.addTrackToPlaylist;
};

const removeTrackFromPlaylist = async (
  playlistId: string,
  trackId: string,
  userId: string = 'default',
): Promise<boolean> => {
  const data = await graffleClient.request<{
    removeTrackFromPlaylist: boolean;
  }>(REMOVE_TRACK_FROM_PLAYLIST, { playlistId, trackId, userId });
  return data.removeTrackFromPlaylist;
};

const fetchPlaylistRecommendations = async (
  playlistId: string,
  limit = 20,
  excludeTrackIds?: string[],
): Promise<TrackRecommendation[]> => {
  const data = await graffleClient.request<{
    playlistRecommendations: TrackRecommendation[];
  }>(GET_PLAYLIST_RECOMMENDATIONS, {
    playlistId,
    limit,
    excludeTrackIds,
  });
  return data.playlistRecommendations;
};

// Hooks
export function usePlaylists(userId: string = 'default') {
  const queryClient = useQueryClient();

  const {
    data: playlists = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<PlaylistItem[]>({
    queryKey: ['playlists', userId],
    queryFn: () => fetchPlaylists(userId),
  });

  const createPlaylistMutation = useMutation({
    mutationFn: createPlaylist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: (id: string) => deletePlaylist(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });

  const addTrackMutation = useMutation({
    mutationFn: ({
      playlistId,
      input,
    }: {
      playlistId: string;
      input: AddTrackToPlaylistInput;
    }) => addTrackToPlaylist(playlistId, input, userId),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    },
  });

  const removeTrackMutation = useMutation({
    mutationFn: ({
      playlistId,
      trackId,
    }: {
      playlistId: string;
      trackId: string;
    }) => removeTrackFromPlaylist(playlistId, trackId, userId),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    },
  });

  return {
    playlists,
    loading,
    error: error?.message,
    refetch,
    createPlaylist: createPlaylistMutation.mutateAsync,
    deletePlaylist: deletePlaylistMutation.mutateAsync,
    addTrackToPlaylist: (playlistId: string, input: AddTrackToPlaylistInput) =>
      addTrackMutation.mutateAsync({ playlistId, input }),
    removeTrackFromPlaylist: (playlistId: string, trackId: string) =>
      removeTrackMutation.mutateAsync({ playlistId, trackId }),
  };
}

export function usePlaylist(id: string, userId: string = 'default') {
  const queryClient = useQueryClient();

  const {
    data: playlist,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['playlist', id, userId],
    queryFn: () => fetchPlaylist(id, userId),
    enabled: !!id,
  });

  const updatePlaylistMutation = useMutation({
    mutationFn: (input: UpdatePlaylistInput) =>
      updatePlaylist(id, input, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', id] });
    },
  });

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

  return {
    playlist,
    loading,
    error: error?.message,
    refetch,
    updatePlaylist: updatePlaylistMutation.mutateAsync,
    syncToYouTube: syncToYouTubeMutation.mutateAsync,
    isSyncingToYouTube: syncToYouTubeMutation.isPending,
    syncToYouTubeError: syncToYouTubeMutation.error,
    syncToTidal: syncToTidalMutation.mutateAsync,
    isSyncingToTidal: syncToTidalMutation.isPending,
    syncToTidalError: syncToTidalMutation.error,
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
    mutationFn: ({
      code,
      codeVerifier,
    }: {
      code: string;
      codeVerifier: string;
    }) => authenticateTidal(code, codeVerifier, userId),
  });

  return {
    getAuthUrl: getAuthUrlMutation.mutateAsync,
    authenticate: authenticateMutation.mutateAsync,
    isGettingAuthUrl: getAuthUrlMutation.isPending,
    isAuthenticating: authenticateMutation.isPending,
    authError: authenticateMutation.error,
  };
}

export function usePlaylistByName(name: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['playlistByName', name],
    queryFn: () => fetchPlaylistByName(name),
    enabled: !!name,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });
  return {
    createPlaylist: createPlaylistMutation.mutateAsync,
  };
}

export function useDeletePlaylist(userId: string = 'default') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePlaylist(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });
}

export function useExportPlaylistToM3U(userId: string = 'default') {
  return useMutation({
    mutationFn: (playlistId: string) => exportPlaylistToM3U(playlistId, userId),
  });
}

export function useAddTrackToPlaylist(userId: string = 'default') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      playlistId,
      input,
    }: {
      playlistId: string;
      input: AddTrackToPlaylistInput;
    }) => addTrackToPlaylist(playlistId, input, userId),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    },
  });
}

export function useRemoveTrackFromPlaylist(userId: string = 'default') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      playlistId,
      trackId,
    }: {
      playlistId: string;
      trackId: string;
    }) => removeTrackFromPlaylist(playlistId, trackId, userId),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    },
  });
}

export function usePlaylistRecommendations(
  playlistId: string,
  limit = 20,
  excludeTrackIds?: string[],
) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['playlistRecommendations', playlistId, limit, excludeTrackIds],
    queryFn: () =>
      fetchPlaylistRecommendations(playlistId, limit, excludeTrackIds),
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
