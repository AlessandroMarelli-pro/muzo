import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../../shared/services/prisma.service';
import { Id3ReaderService } from '../utils/id3-reader.service';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  duration_ms: number;
  external_ids?: { isrc?: string };
  uri: string;
}

export interface TrackMatchResult {
  trackId: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
  matchedTrack?: SpotifyTrack;
}

@Injectable()
export class SpotifyService implements OnModuleInit {
  private readonly logger = new Logger(SpotifyService.name);
  private readonly baseUrl = 'https://api.spotify.com/v1';
  private readonly authUrl = 'https://accounts.spotify.com';
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly id3Reader: Id3ReaderService,
  ) {
    this.clientId = this.configService.get<string>('SPOTIFY_CLIENT_ID') || '';
    this.clientSecret =
      this.configService.get<string>('SPOTIFY_CLIENT_SECRET') || '';
    this.redirectUri =
      this.configService.get<string>('SPOTIFY_REDIRECT_URI') ||
      'http://localhost:3000';

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'Spotify OAuth2 not fully configured. Spotify sync will not be available.',
      );
    }
  }

  /**
   * Initialize on module startup - check for tokens (no API calls to save quota)
   */
  async onModuleInit() {
    const defaultUserId = this.configService.get<string>(
      'SPOTIFY_DEFAULT_USER_ID',
      'default',
    );

    try {
      // Just check if tokens exist, don't validate with API call (saves quota)
      const tokenRecord = await this.prisma.thirdPartyOAuthToken.findUnique({
        where: {
          userId_provider: {
            userId: defaultUserId,
            provider: 'spotify',
          },
        },
      });

      if (tokenRecord) {
        // Check if token needs refresh (but don't call API yet)
        const needsRefresh =
          tokenRecord.expiresAt &&
          tokenRecord.expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

        if (needsRefresh && tokenRecord.refreshToken) {
          // Silently refresh in background (no validation API call)
          this.refreshAccessToken(
            defaultUserId,
            tokenRecord.refreshToken,
          ).catch((error) => {
            this.logger.warn(
              `Failed to refresh Spotify token on startup: ${error.message}`,
            );
          });
        }

        this.logger.log(
          `Spotify tokens found for user: ${defaultUserId} (will validate on first use)`,
        );
      } else {
        this.logger.warn(
          `Spotify not authenticated for user ${defaultUserId}. Sync will require manual authentication.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to check Spotify tokens on startup: ${error.message}`,
      );
    }
  }

  /**
   * Generate PKCE code verifier and challenge
   * Based on Spotify PKCE documentation: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
   */
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    // Generate a random code verifier (43-128 characters, high-entropy)
    // Using 64 characters as recommended
    const codeVerifier = this.base64URLEncode(crypto.randomBytes(32));

    // Generate code challenge (SHA256 hash of verifier, base64url encoded)
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Base64 URL encode helper
   */
  private base64URLEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Get Spotify authorization URL for OAuth2 PKCE flow
   * Returns both the URL and codeVerifier (needed for token exchange)
   */
  getAuthUrl(): { authUrl: string; codeVerifier: string } {
    if (!this.clientId) {
      throw new UnauthorizedException('Spotify OAuth2 not configured');
    }

    const redirectUri = this.redirectUri || 'http://localhost:3000';
    const { codeVerifier, codeChallenge } = this.generatePKCE();

    // Scopes per Spotify API: https://developer.spotify.com/documentation/web-api/concepts/scopes
    const scopes = [
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-private',
      'user-read-email',
    ].join(' ');

    this.logger.debug(
      `Generating Spotify auth URL with client_id: ${this.clientId.substring(0, 5)}..., redirect_uri: ${redirectUri}`,
    );

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    const authUrl = `${this.authUrl}/authorize?${params.toString()}`;
    this.logger.debug(
      `Spotify auth URL generated: ${authUrl.substring(0, 100)}...`,
    );

    return { authUrl, codeVerifier };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!this.clientId) {
      throw new UnauthorizedException('Spotify OAuth2 not configured');
    }

    const tokenUrl = `${this.authUrl}/api/token`;
    const redirectUri = this.redirectUri || 'http://localhost:3000';

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      code_verifier: codeVerifier,
    });

    this.logger.debug(
      `Exchanging Spotify authorization code. Redirect URI: ${redirectUri}, Code length: ${code.length}, Verifier length: ${codeVerifier.length}`,
    );

    // Spotify uses Basic Auth with client_id:client_secret
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to exchange code for tokens (${response.status})`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage =
          errorData.error_description || errorData.error || errorText;

        this.logger.error(`Spotify token exchange error:`, {
          status: response.status,
          error: errorData.error,
          error_description: errorData.error_description,
          redirect_uri: redirectUri,
          client_id: this.clientId?.substring(0, 5) + '...',
        });

        if (errorData.error === 'invalid_grant') {
          errorMessage =
            'Invalid authorization code. The code may have expired or already been used. Please try authenticating again.';
        } else if (errorData.error === 'invalid_client') {
          errorMessage =
            'Invalid client credentials. Please check your SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.';
        } else if (errorData.error === 'redirect_uri_mismatch') {
          errorMessage = `Redirect URI mismatch. The redirect URI "${redirectUri}" must match exactly what's registered in your Spotify Developer Dashboard.`;
        } else if (errorData.error_description) {
          errorMessage = errorData.error_description;
        }
      } catch {
        this.logger.error(`Spotify token exchange error (raw): ${errorText}`);
      }

      throw new UnauthorizedException(errorMessage);
    }

    const data = await response.json();
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;

    if (!accessToken) {
      throw new UnauthorizedException('Failed to get access token');
    }

    // Calculate expiry date (default to 1 hour if not provided)
    const expiresIn = data.expires_in || 3600;
    const expiryDate = new Date(Date.now() + expiresIn * 1000);

    // Store tokens in database
    await this.saveTokens(userId, accessToken, refreshToken, expiryDate);

    return { accessToken, refreshToken: refreshToken || '' };
  }

  /**
   * Get or refresh access token for user
   */
  async getAccessToken(userId: string): Promise<string> {
    const tokenRecord = await this.prisma.thirdPartyOAuthToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'spotify',
        },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(
        'Spotify not authenticated. Please authorize first.',
      );
    }

    // Check if token is expired
    if (tokenRecord.expiresAt && tokenRecord.expiresAt.getTime() < Date.now()) {
      // Refresh token
      if (!tokenRecord.refreshToken) {
        throw new UnauthorizedException('No refresh token available');
      }
      return this.refreshAccessToken(userId, tokenRecord.refreshToken);
    }

    return tokenRecord.accessToken;
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(
    userId: string,
    refreshToken: string,
  ): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new UnauthorizedException('Spotify OAuth2 not configured');
    }

    const tokenUrl = `${this.authUrl}/api/token`;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    // Spotify uses Basic Auth with client_id:client_secret
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to refresh token (${response.status})`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage =
          errorData.error_description || errorData.error || errorText;
        this.logger.error(
          `Spotify token refresh error: ${JSON.stringify(errorData)}`,
        );
      } catch {
        this.logger.error(`Spotify token refresh error (raw): ${errorText}`);
      }

      throw new UnauthorizedException(errorMessage);
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token || refreshToken;

    if (!newAccessToken) {
      throw new UnauthorizedException('Failed to get new access token');
    }

    // Calculate expiry date
    const expiresIn = data.expires_in || 3600;
    const expiryDate = new Date(Date.now() + expiresIn * 1000);

    // Update stored token
    await this.prisma.thirdPartyOAuthToken.update({
      where: {
        userId_provider: {
          userId,
          provider: 'spotify',
        },
      },
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: expiryDate,
      },
    });

    return newAccessToken;
  }

  /**
   * Save OAuth tokens to database
   */
  private async saveTokens(
    userId: string,
    accessToken: string,
    refreshToken: string | null,
    expiryDate: Date,
  ) {
    await this.prisma.thirdPartyOAuthToken.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'spotify',
        },
      },
      create: {
        userId,
        provider: 'spotify',
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: expiryDate,
        scope: 'spotify',
      },
      update: {
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: expiryDate,
      },
    });
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest(
    userId: string,
    endpoint: string,
    options: RequestInit = {},
  ): Promise<any> {
    const accessToken = await this.getAccessToken(userId);

    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Spotify API error: ${response.status} - ${errorText}`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = `Spotify API error: ${response.status} - ${JSON.stringify(errorData)}`;
        this.logger.error(`Spotify API error:`, {
          status: response.status,
          endpoint,
          error: errorData,
        });
      } catch {
        this.logger.error(
          `Spotify API error (raw): ${response.status} - ${errorText}`,
        );
      }

      if (response.status === 401) {
        throw new UnauthorizedException(
          'Spotify authentication expired. Please re-authenticate.',
        );
      }

      throw new Error(errorMessage);
    }

    // Handle empty responses (e.g., 204 No Content)
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0' || response.status === 204) {
      return null;
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      this.logger.warn(`Failed to parse Spotify API response as JSON: ${text}`);
      return null;
    }
  }

  /**
   * Extract track ID from Spotify URL
   */
  extractTrackIdFromUrl(url: string): string | null {
    try {
      // Spotify URLs: https://open.spotify.com/track/{id}
      // Spotify URIs: spotify:track:{id}
      const trackIdMatch =
        url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/) ||
        url.match(/spotify:track:([a-zA-Z0-9]+)/);
      return trackIdMatch ? trackIdMatch[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Search for tracks on Spotify
   */
  async searchTracks(
    query: string,
    userId: string,
    limit: number = 20,
  ): Promise<SpotifyTrack[]> {
    this.logger.debug(
      `Spotify API: Searching for "${query}" (1 API call: search)`,
    );

    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: limit.toString(),
    });

    const response = await this.makeRequest(
      userId,
      `/search?${params.toString()}`,
      {
        method: 'GET',
      },
    );

    if (!response || !response.tracks || !response.tracks.items) {
      return [];
    }

    return response.tracks.items;
  }

  /**
   * Find best matching track
   */
  async findBestMatch(
    artist: string,
    title: string,
    duration: number,
    userId: string,
  ): Promise<TrackMatchResult> {
    try {
      // Build search query
      const query = `artist:"${artist}" track:"${title}"`;
      const tracks = await this.searchTracks(query, userId, 10);

      if (tracks.length === 0) {
        // Try fuzzy search without quotes
        const fuzzyQuery = `${artist} ${title}`;
        const fuzzyTracks = await this.searchTracks(fuzzyQuery, userId, 10);

        if (fuzzyTracks.length === 0) {
          return { trackId: null, confidence: 'none' };
        }

        // Return first fuzzy match
        return {
          trackId: fuzzyTracks[0].id,
          confidence: 'fuzzy',
          matchedTrack: fuzzyTracks[0],
        };
      }

      // Find exact match by duration (within 5 seconds)
      const exactMatch = tracks.find((track) => {
        const trackDuration = track.duration_ms / 1000; // Convert to seconds
        return Math.abs(trackDuration - duration) <= 5;
      });

      if (exactMatch) {
        return {
          trackId: exactMatch.id,
          confidence: 'exact',
          matchedTrack: exactMatch,
        };
      }

      // Return first match if no exact duration match
      return {
        trackId: tracks[0].id,
        confidence: 'fuzzy',
        matchedTrack: tracks[0],
      };
    } catch (error) {
      this.logger.error(`Failed to search Spotify tracks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current user's Spotify ID
   */
  async getCurrentUserId(userId: string): Promise<string> {
    const userProfile = await this.makeRequest(userId, '/me', {
      method: 'GET',
    });

    if (!userProfile || !userProfile.id) {
      throw new Error('Failed to get Spotify user ID');
    }

    return userProfile.id;
  }

  /**
   * Create a Spotify playlist
   */
  async createSpotifyPlaylist(
    userId: string,
    name: string,
    description?: string,
  ): Promise<string> {
    this.logger.log(
      `Spotify API: Creating playlist "${name}" (1 API call: POST /users/{id}/playlists)`,
    );

    const spotifyUserId = await this.getCurrentUserId(userId);

    const body = {
      name,
      description: description || '',
      public: false, // Create private playlist by default
    };

    const response = await this.makeRequest(
      userId,
      `/users/${spotifyUserId}/playlists`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );

    if (!response || !response.id) {
      throw new Error('Failed to create Spotify playlist');
    }

    this.logger.log(
      `Successfully created Spotify playlist: ${response.id} (${response.external_urls?.spotify || 'N/A'})`,
    );

    return response.id;
  }

  /**
   * Add tracks to Spotify playlist
   * Spotify allows up to 100 tracks per request
   */
  async addTracksToPlaylist(
    userId: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void> {
    if (trackIds.length === 0) {
      return;
    }

    this.logger.log(
      `Spotify API: Adding ${trackIds.length} tracks to playlist (${Math.ceil(trackIds.length / 100)} API calls: POST /playlists/{id}/tracks)`,
    );

    // Spotify allows up to 100 tracks per request
    const maxItemsPerRequest = 100;
    const batches = Math.ceil(trackIds.length / maxItemsPerRequest);

    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const startIndex = batchIndex * maxItemsPerRequest;
      const endIndex = Math.min(
        startIndex + maxItemsPerRequest,
        trackIds.length,
      );
      const batchTrackIds = trackIds.slice(startIndex, endIndex);

      // Convert track IDs to Spotify URIs (spotify:track:{id})
      const trackUris = batchTrackIds.map((id) => `spotify:track:${id}`);

      const body = {
        uris: trackUris,
      };

      try {
        await this.makeRequest(userId, `/playlists/${playlistId}/tracks`, {
          method: 'POST',
          body: JSON.stringify(body),
        });

        this.logger.debug(
          `Added batch ${batchIndex + 1}/${batches} (${batchTrackIds.length} tracks) to Spotify playlist`,
        );

        // Add delay between batches to avoid rate limiting (100ms)
        if (batchIndex < batches - 1) {
          await this.delay(100);
        }
      } catch (error) {
        this.logger.error(
          `Failed to add batch ${batchIndex + 1} to Spotify playlist: ${error.message}`,
        );
        throw error;
      }
    }

    this.logger.log(
      `Successfully added ${trackIds.length} tracks to Spotify playlist`,
    );
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
