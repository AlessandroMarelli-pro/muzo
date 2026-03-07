import { createToken } from '../../utils/create-token';

export interface VideoMatchResult {
  videoId: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
  matchedVideo?: { id: string; title: string; duration: number };
}

export const YOUTUBE_SYNC_PROVIDER = createToken<IYouTubeSyncProvider>('YOUTUBE_SYNC_PROVIDER');

export interface IYouTubeSyncProvider {
  getAuthUrl(): string;
  exchangeCodeForTokens(
    code: string,
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }>;
  getAccessToken(userId: string): Promise<string>;
  extractVideoIdFromUrl(url: string): string | null;
  findBestMatch(
    artist: string,
    title: string,
    trackDurationSeconds: number,
    userId: string,
  ): Promise<VideoMatchResult>;
  createPlaylist(userId: string, name: string, description?: string): Promise<string>;
  addVideosToPlaylist(userId: string, playlistId: string, videoIds: string[]): Promise<void>;
}
