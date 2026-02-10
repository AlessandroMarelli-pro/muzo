import { createToken } from '../../utils/create-token';

export interface SpotifyAuthUrlResult {
  authUrl: string;
  codeVerifier: string;
}

export interface SpotifyTrackMatchResult {
  trackId: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
  matchedTrack?: { id: string; duration_ms: number };
}

export const SPOTIFY_SYNC_PROVIDER = createToken<ISpotifySyncProvider>(
  'SPOTIFY_SYNC_PROVIDER',
);

export interface ISpotifySyncProvider {
  getAuthUrl(): SpotifyAuthUrlResult;
  exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }>;
  getAccessToken(userId: string): Promise<string>;
  extractTrackIdFromUrl(url: string): string | null;
  findBestMatch(
    artist: string,
    title: string,
    trackDurationSeconds: number,
    userId: string,
  ): Promise<SpotifyTrackMatchResult>;
  createPlaylist(
    userId: string,
    name: string,
    description?: string,
  ): Promise<string>;
  addTracksToPlaylist(
    userId: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void>;
}
