import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  ITidalSyncProvider,
  TidalAuthUrlResult,
  TrackMatchResult,
} from 'src/application/ports/infrastructure/ITidalSyncProvider';
import {
  IOAuthTokenRepository,
  OAUTH_TOKEN_REPOSITORY,
} from 'src/application/ports/repositories/IOAuthTokenRepository';

const BASE_URL = 'https://openapi.tidal.com/v2';

@Injectable()
export class TidalSyncAdapter implements ITidalSyncProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(OAUTH_TOKEN_REPOSITORY)
    private readonly oauthTokenRepository: IOAuthTokenRepository,
  ) {
    this.clientId = this.configService.get<string>('TIDAL_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('TIDAL_CLIENT_SECRET') || '';
    this.redirectUri =
      this.configService.get<string>('TIDAL_REDIRECT_URI') || 'http://localhost:3000';
  }

  private base64URLEncode(buffer: Buffer): string {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = this.base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return { codeVerifier, codeChallenge };
  }

  getAuthUrl(): TidalAuthUrlResult {
    if (!this.clientId) throw new Error('TIDAL OAuth2 not configured');
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    const scopes = ['playlists.read', 'playlists.write', 'user.read', 'search.read'].join(' ');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    const authUrl = `https://login.tidal.com/authorize?${params.toString()}`;
    return { authUrl, codeVerifier };
  }

  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('TIDAL OAuth2 not configured');
    }
    const tokenUrl = 'https://auth.tidal.com/v1/oauth2/token';
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code_verifier: codeVerifier,
    });
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!response.ok) {
      const text = await response.text();
      let msg = `Failed to exchange code (${response.status})`;
      try {
        const data = JSON.parse(text);
        msg = data.error_description || data.error || text;
      } catch {
        msg = text;
      }
      throw new Error(msg);
    }
    const data = await response.json();
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;
    if (!accessToken) throw new Error('Failed to get access token');
    const expiresIn = data.expires_in || 3600;
    const expiryDate = new Date(Date.now() + expiresIn * 1000);
    await this.oauthTokenRepository.saveToken({
      userId,
      provider: 'tidal',
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: expiryDate,
    });
    return { accessToken, refreshToken: refreshToken || '' };
  }

  async getAccessToken(userId: string): Promise<string> {
    const tokenRecord = await this.oauthTokenRepository.getToken(userId, 'tidal');
    if (!tokenRecord) {
      throw new Error('TIDAL not authenticated. Please authorize first.');
    }
    if (tokenRecord.expiresAt && tokenRecord.expiresAt.getTime() < Date.now()) {
      if (!tokenRecord.refreshToken) {
        throw new Error('No refresh token available');
      }
      return this.refreshAccessToken(userId, tokenRecord.refreshToken);
    }
    return tokenRecord.accessToken;
  }

  private async refreshAccessToken(userId: string, refreshToken: string): Promise<string> {
    const tokenUrl = 'https://auth.tidal.com/v1/oauth2/token';
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!response.ok) throw new Error('Failed to refresh TIDAL token');
    const data = await response.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token || refreshToken;
    if (!newAccessToken) throw new Error('Failed to get new access token');
    const expiresIn = data.expires_in || 3600;
    const expiryDate = new Date(Date.now() + expiresIn * 1000);
    await this.oauthTokenRepository.updateToken(userId, 'tidal', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: expiryDate,
    });
    return newAccessToken;
  }

  extractTrackIdFromUrl(url: string): string | null {
    const match = url.match(/\/track\/(\d+)/);
    return match ? match[1] : null;
  }

  private async makeRequest(
    userId: string,
    endpoint: string,
    options: RequestInit = {},
  ): Promise<unknown> {
    const accessToken = await this.getAccessToken(userId);
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers as object),
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`TIDAL API error: ${response.status} - ${text}`);
    }
    const text = await response.text();
    if (!text?.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private async searchTracks(
    query: string,
    userId: string,
    limit: number,
  ): Promise<{ id: string; title: string; artist: string; duration: number }[]> {
    await this.delay(200);
    const response = (await this.makeRequest(
      userId,
      `/search?query=${encodeURIComponent(query)}&limit=${limit}&types=tracks`,
      { method: 'GET' },
    )) as {
      data?: Array<{
        type: string;
        id: string;
        attributes?: { title?: string; duration?: string };
        relationships?: unknown;
      }>;
    };
    if (!response?.data || !Array.isArray(response.data)) return [];
    return response.data
      .filter((item: { type: string }) => item.type === 'tracks')
      .map((item: { id: string; attributes?: { title?: string; duration?: string } }) => ({
        id: item.id,
        title: item.attributes?.title || '',
        artist: 'Unknown Artist',
        duration: this.parseDuration(item.attributes?.duration || 'PT0S'),
      }));
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async findBestMatch(
    artist: string,
    title: string,
    trackDuration: number,
    userId: string,
  ): Promise<TrackMatchResult> {
    const tracks = await this.searchTracks(`${artist} - ${title}`, userId, 5);
    if (tracks.length === 0) return { trackId: null, confidence: 'none' };

    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();
    const normalizedArtist = normalize(artist);
    const normalizedTitle = normalize(title);
    const searchTerms = `${normalizedArtist} ${normalizedTitle}`.split(/\s+/);

    for (const track of tracks) {
      const trackTitle = normalize(track.title);
      const trackArtist = normalize(track.artist);
      const trackTerms = `${trackArtist} ${trackTitle}`.split(/\s+/);
      const allTermsMatch = searchTerms.every((term) =>
        trackTerms.some((tt) => tt.includes(term) || term.includes(tt)),
      );
      if (allTermsMatch) {
        const durationDiff = Math.abs(track.duration - trackDuration);
        if (durationDiff <= 10) {
          return {
            trackId: track.id,
            confidence: 'exact',
            matchedTrack: track,
          };
        }
      }
    }

    let bestMatch: (typeof tracks)[0] | null = null;
    let bestScore = 0;
    for (const track of tracks) {
      const trackTitle = normalize(track.title);
      const trackArtist = normalize(track.artist);
      let score = 0;
      const titleWords = normalizedTitle.split(/\s+/);
      score += (titleWords.filter((w) => trackTitle.includes(w)).length / titleWords.length) * 0.5;
      const artistWords = normalizedArtist.split(/\s+/);
      score +=
        (artistWords.filter((w) => trackArtist.includes(w)).length / artistWords.length) * 0.3;
      const durationDiff = Math.abs(track.duration - trackDuration);
      score += Math.max(0, 0.2 - durationDiff / 100);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = track;
      }
    }
    if (bestMatch && bestScore > 0.3) {
      return {
        trackId: bestMatch.id,
        confidence: 'fuzzy',
        matchedTrack: bestMatch,
      };
    }
    return { trackId: null, confidence: 'none' };
  }

  async createPlaylist(userId: string, name: string, description?: string): Promise<string> {
    const requestBody = {
      data: {
        type: 'playlists',
        attributes: {
          name,
          description: description || 'Playlist synced from Muzo',
        },
      },
    };
    const response = (await this.makeRequest(userId, '/playlists', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })) as { data?: { id?: string } };
    const playlistId = response?.data?.id;
    if (!playlistId) throw new Error('Failed to create TIDAL playlist');
    return playlistId;
  }

  async addTracksToPlaylist(userId: string, playlistId: string, trackIds: string[]): Promise<void> {
    const maxItems = 20;
    for (let i = 0; i < trackIds.length; i += maxItems) {
      const batch = trackIds.slice(i, i + maxItems);
      const data = batch.map((trackId) => ({
        type: 'tracks' as const,
        id: trackId,
        meta: { addedAt: new Date().toISOString() },
      }));
      await this.makeRequest(userId, `/playlists/${playlistId}/relationships/items`, {
        method: 'POST',
        body: JSON.stringify({ data }),
      });
      if (i + maxItems < trackIds.length) await this.delay(100);
    }
  }
}
