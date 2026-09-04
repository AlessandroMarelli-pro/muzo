import { createToken } from '../../utils/create-token';

export interface TidalAuthUrlResult {
  authUrl: string;
  codeVerifier: string;
}

export interface TrackMatchResult {
  trackId: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
  matchedTrack?: {
    id: string;
    title: string;
    artist: string;
    duration: number;
  };
}

export const TIDAL_SYNC_PROVIDER = createToken<ITidalSyncProvider>('TIDAL_SYNC_PROVIDER');

export interface ITidalSyncProvider {
  getAuthUrl(): Promise<TidalAuthUrlResult>;
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
  ): Promise<TrackMatchResult>;
  createPlaylist(userId: string, name: string, description?: string): Promise<string>;
  addTracksToPlaylist(userId: string, playlistId: string, trackIds: string[]): Promise<void>;
}
