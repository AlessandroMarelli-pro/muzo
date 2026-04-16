import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  ISpotifySyncProvider,
  SpotifyAuthUrlResult,
  SpotifyTrackMatchResult,
} from 'src/application/ports/infrastructure/ISpotifySyncProvider';
import {
  IOAuthTokenRepository,
  OAUTH_TOKEN_REPOSITORY,
} from 'src/application/ports/repositories/IOAuthTokenRepository';

const BASE_URL = 'https://api.spotify.com/v1';
const AUTH_URL = 'https://accounts.spotify.com';

@Injectable()
export class SpotifySyncAdapter implements ISpotifySyncProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(OAUTH_TOKEN_REPOSITORY)
    private readonly oauthTokenRepository: IOAuthTokenRepository,
  ) {
    this.clientId = this.configService.get<string>('SPOTIFY_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('SPOTIFY_CLIENT_SECRET') || '';
    this.redirectUri =
      this.configService.get<string>('SPOTIFY_REDIRECT_URI') || 'http://localhost:3000';
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

  getAuthUrl(): SpotifyAuthUrlResult {
    if (!this.clientId) throw new Error('Spotify OAuth2 not configured');
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    const scopes = [
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-private',
      'user-read-email',
    ].join(' ');
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });
    const authUrl = `${AUTH_URL}/authorize?${params.toString()}`;
    return { authUrl, codeVerifier };
  }

  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!this.clientId) throw new Error('Spotify OAuth2 not configured');
    const tokenUrl = `${AUTH_URL}/api/token`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: codeVerifier,
    });
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
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
      provider: 'spotify',
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: expiryDate,
    });
    return { accessToken, refreshToken: refreshToken || '' };
  }

  async getAccessToken(userId: string): Promise<string> {
    const tokenRecord = await this.oauthTokenRepository.getToken(userId, 'spotify');
    if (!tokenRecord) {
      throw new Error('Spotify not authenticated. Please authorize first.');
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
    const tokenUrl = `${AUTH_URL}/api/token`;
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
    });
    if (!response.ok) throw new Error('Failed to refresh Spotify token');
    const data = await response.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token || refreshToken;
    if (!newAccessToken) throw new Error('Failed to get new access token');
    const expiresIn = data.expires_in || 3600;
    const expiryDate = new Date(Date.now() + expiresIn * 1000);
    await this.oauthTokenRepository.updateToken(userId, 'spotify', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: expiryDate,
    });
    return newAccessToken;
  }

  extractTrackIdFromUrl(url: string): string | null {
    const trackIdMatch =
      url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/) || url.match(/spotify:track:([a-zA-Z0-9]+)/);
    return trackIdMatch ? trackIdMatch[1] : null;
  }

  private async makeRequest(
    userId: string,
    endpoint: string,
    options: RequestInit = {},
  ): Promise<unknown> {
    const accessToken = await this.getAccessToken(userId);
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers as object),
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Spotify API error: ${response.status} - ${text}`);
    }
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private async searchTracks(
    query: string,
    userId: string,
    limit: number,
  ): Promise<{ id: string; duration_ms: number }[]> {
    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: limit.toString(),
    });
    const response = (await this.makeRequest(userId, `/search?${params.toString()}`, {
      method: 'GET',
    })) as { tracks?: { items?: { id: string; duration_ms: number }[] } };
    return response?.tracks?.items ?? [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async findBestMatch(
    artist: string,
    title: string,
    durationSeconds: number,
    userId: string,
  ): Promise<SpotifyTrackMatchResult> {
    try {
      const query = `artist:"${artist}" track:"${title}"`;
      const tracks = await this.searchTracks(query, userId, 10);
      console.log('tracks', tracks, query);
      if (tracks.length === 0) {
        const fuzzyTracks = await this.searchTracks(`${artist} ${title}`, userId, 10);
        if (fuzzyTracks.length === 0) {
          return { trackId: null, confidence: 'none' };
        }
        return {
          trackId: fuzzyTracks[0].id,
          confidence: 'fuzzy',
          matchedTrack: fuzzyTracks[0] as { id: string; duration_ms: number },
        };
      }
      const durationMs = durationSeconds * 1000;
      const exactMatch = tracks.find((t) => Math.abs(t.duration_ms - durationMs) <= 5000);
      if (exactMatch) {
        return {
          trackId: exactMatch.id,
          confidence: 'exact',
          matchedTrack: exactMatch,
        };
      }
      return {
        trackId: tracks[0].id,
        confidence: 'fuzzy',
        matchedTrack: tracks[0],
      };
    } catch {
      return { trackId: null, confidence: 'none' };
    }
  }

  async createPlaylist(userId: string, name: string, description?: string): Promise<string> {
    const me = (await this.makeRequest(userId, '/me', {
      method: 'GET',
    })) as { id?: string };
    const spotifyUserId = me?.id;
    if (!spotifyUserId) throw new Error('Failed to get Spotify user ID');
    const body = {
      name,
      description: description || '',
      public: false,
    };
    const response = (await this.makeRequest(userId, `/users/${spotifyUserId}/playlists`, {
      method: 'POST',
      body: JSON.stringify(body),
    })) as { id?: string };
    if (!response?.id) throw new Error('Failed to create Spotify playlist');
    return response.id;
  }

  async addTracksToPlaylist(userId: string, playlistId: string, trackIds: string[]): Promise<void> {
    const maxItems = 100;
    for (let i = 0; i < trackIds.length; i += maxItems) {
      const batch = trackIds.slice(i, i + maxItems);
      const uris = batch.map((id) => `spotify:track:${id}`);
      await this.makeRequest(userId, `/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ uris }),
      });
      if (i + maxItems < trackIds.length) await this.delay(100);
    }
  }
}
