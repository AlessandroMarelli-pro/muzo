import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Auth, google } from 'googleapis';
import {
  IYouTubeSyncProvider,
  VideoMatchResult,
} from 'src/application/ports/infrastructure/IYouTubeSyncProvider';
import {
  IIntegrationSettingsRepository,
  INTEGRATION_SETTINGS_REPOSITORY,
} from 'src/application/ports/repositories/IIntegrationSettingsRepository';
import {
  IOAuthTokenRepository,
  OAUTH_TOKEN_REPOSITORY,
} from 'src/application/ports/repositories/IOAuthTokenRepository';

@Injectable()
export class YoutubeSyncAdapter implements IYouTubeSyncProvider {
  constructor(
    private readonly configService: ConfigService,
    @Inject(OAUTH_TOKEN_REPOSITORY)
    private readonly oauthTokenRepository: IOAuthTokenRepository,
    @Inject(INTEGRATION_SETTINGS_REPOSITORY)
    private readonly integrationSettingsRepository: IIntegrationSettingsRepository,
  ) {}

  /**
   * Builds a fresh OAuth2 client from the current credentials -- the settings row wins per field,
   * falling back to YOUTUBE_CLIENT_ID / _SECRET / _REDIRECT_URI in the environment. Returns null
   * when no client id/secret/redirect is available anywhere.
   */
  private async getOAuth2Client(): Promise<Auth.OAuth2Client | null> {
    const s = await this.integrationSettingsRepository.get();
    const clientId = s.youtubeClientId || this.configService.get<string>('YOUTUBE_CLIENT_ID');
    const clientSecret =
      s.youtubeClientSecret || this.configService.get<string>('YOUTUBE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('YOUTUBE_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) return null;
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  async getAuthUrl(): Promise<string> {
    const oauth2Client = await this.getOAuth2Client();
    if (!oauth2Client) {
      throw new Error('YouTube OAuth2 not configured');
    }
    const scopes = [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ];
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  async exchangeCodeForTokens(
    code: string,
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const oauth2Client = await this.getOAuth2Client();
    if (!oauth2Client) {
      throw new Error('YouTube OAuth2 not configured');
    }
    const { tokens } = await oauth2Client.getToken(code);
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    if (!accessToken) {
      throw new Error('Failed to get access token');
    }
    await this.oauthTokenRepository.saveToken({
      userId,
      provider: 'youtube',
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    });
    return { accessToken, refreshToken: refreshToken || '' };
  }

  async getAccessToken(userId: string): Promise<string> {
    const tokenRecord = await this.oauthTokenRepository.getToken(userId, 'youtube');
    if (!tokenRecord) {
      throw new Error('YouTube not authenticated. Please authorize first.');
    }
    if (tokenRecord.expiresAt && tokenRecord.expiresAt.getTime() < Date.now()) {
      return this.refreshAccessToken(userId, tokenRecord.refreshToken);
    }
    return tokenRecord.accessToken;
  }

  private async refreshAccessToken(userId: string, refreshToken: string | null): Promise<string> {
    const oauth2Client = await this.getOAuth2Client();
    if (!refreshToken || !oauth2Client) {
      throw new Error('No refresh token available');
    }
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    const newAccessToken = credentials.access_token;
    if (!newAccessToken) {
      throw new Error('Failed to refresh access token');
    }
    await this.oauthTokenRepository.updateToken(userId, 'youtube', {
      accessToken: newAccessToken,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
    });
    return newAccessToken;
  }

  extractVideoIdFromUrl(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  async findBestMatch(
    artist: string,
    title: string,
    trackDuration: number,
    userId: string,
  ): Promise<VideoMatchResult> {
    const videos = await this.searchVideos(`${artist} - ${title}`, userId, 5);
    if (videos.length === 0) return { videoId: null, confidence: 'none' };

    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();
    const normalizedArtist = normalize(artist);
    const normalizedTitle = normalize(title);
    const searchTerms = `${normalizedArtist} ${normalizedTitle}`.split(/\s+/);

    for (const video of videos) {
      const videoTitle = normalize(video.title);
      const videoTerms = videoTitle.split(/\s+/);
      const allTermsMatch = searchTerms.every((term) =>
        videoTerms.some((vt) => vt.includes(term) || term.includes(vt)),
      );
      if (allTermsMatch) {
        const durationDiff = Math.abs(video.duration - trackDuration);
        if (durationDiff <= 10) {
          return {
            videoId: video.id,
            confidence: 'exact',
            matchedVideo: video,
          };
        }
      }
    }

    let bestMatch: { id: string; title: string; duration: number } | null = null;
    let bestScore = 0;
    for (const video of videos) {
      const videoTitle = normalize(video.title);
      let score = 0;
      const titleWords = normalizedTitle.split(/\s+/);
      score += (titleWords.filter((w) => videoTitle.includes(w)).length / titleWords.length) * 0.5;
      const artistWords = normalizedArtist.split(/\s+/);
      score +=
        (artistWords.filter((w) => videoTitle.includes(w)).length / artistWords.length) * 0.3;
      const durationDiff = Math.abs(video.duration - trackDuration);
      score += Math.max(0, 0.2 - durationDiff / 100);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = video;
      }
    }
    if (bestMatch && bestScore > 0.3) {
      return {
        videoId: bestMatch.id,
        confidence: 'fuzzy',
        matchedVideo: bestMatch,
      };
    }
    return { videoId: null, confidence: 'none' };
  }

  private async searchVideos(
    query: string,
    userId: string,
    maxResults: number,
  ): Promise<{ id: string; title: string; duration: number }[]> {
    const oauth2Client = await this.getAuthedClient(userId);
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });
    const response = await youtube.search.list({
      part: ['snippet', 'id'],
      q: query,
      type: ['video'],
      maxResults,
      order: 'relevance',
    });
    const videoIds = (response.data.items || [])
      .map((item) => item.id?.videoId)
      .filter((id): id is string => !!id);
    if (videoIds.length === 0) return [];
    const videoDetails = await youtube.videos.list({
      part: ['contentDetails', 'snippet'],
      id: videoIds,
    });
    return (videoDetails.data.items || []).map((item) => ({
      id: item.id || '',
      title: item.snippet?.title || '',
      duration: this.parseDuration(item.contentDetails?.duration || 'PT0S'),
    }));
  }

  private async getAuthedClient(userId: string): Promise<Auth.OAuth2Client> {
    const oauth2Client = await this.getOAuth2Client();
    if (!oauth2Client) throw new Error('YouTube OAuth2 not configured');
    const accessToken = await this.getAccessToken(userId);
    oauth2Client.setCredentials({ access_token: accessToken });
    return oauth2Client;
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  async createPlaylist(userId: string, name: string, description?: string): Promise<string> {
    const oauth2Client = await this.getAuthedClient(userId);
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });
    const response = await youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: name,
          description: description || 'Playlist synced from Muzo',
        },
        status: { privacyStatus: 'private' },
      },
    });
    const playlistId = response.data.id;
    if (!playlistId) throw new Error('Failed to create playlist');
    return playlistId;
  }

  async addVideosToPlaylist(userId: string, playlistId: string, videoIds: string[]): Promise<void> {
    const oauth2Client = await this.getAuthedClient(userId);
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });
    for (let i = 0; i < videoIds.length; i++) {
      try {
        await youtube.playlistItems.insert({
          part: ['snippet'],
          requestBody: {
            snippet: {
              playlistId,
              resourceId: {
                kind: 'youtube#video',
                videoId: videoIds[i],
              },
            },
          },
        });
      } catch {
        // continue with other videos
      }
      if (i < videoIds.length - 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
}
