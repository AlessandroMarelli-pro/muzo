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

export interface TidalTrack {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  isrc?: string;
}

export interface TrackMatchResult {
  trackId: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
  matchedTrack?: TidalTrack;
}

@Injectable()
export class TidalService implements OnModuleInit {
  private readonly logger = new Logger(TidalService.name);
  private readonly baseUrl = 'https://openapi.tidal.com/v2';
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly id3Reader: Id3ReaderService,
  ) {
    this.clientId = this.configService.get<string>('TIDAL_CLIENT_ID') || '';
    this.clientSecret =
      this.configService.get<string>('TIDAL_CLIENT_SECRET') || '';
    this.redirectUri =
      this.configService.get<string>('TIDAL_REDIRECT_URI') ||
      'http://localhost:3000';

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'TIDAL OAuth2 not fully configured. TIDAL sync will not be available.',
      );
    }
  }

  /**
   * Initialize on module startup - check for tokens (no API calls to save quota)
   */
  async onModuleInit() {
    const defaultUserId = this.configService.get<string>(
      'TIDAL_DEFAULT_USER_ID',
      'default',
    );

    try {
      // Just check if tokens exist, don't validate with API call (saves quota)
      const tokenRecord = await this.prisma.thirdPartyOAuthToken.findUnique({
        where: {
          userId_provider: {
            userId: defaultUserId,
            provider: 'tidal',
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
              `Failed to refresh TIDAL token on startup: ${error.message}`,
            );
          });
        }

        this.logger.log(
          `TIDAL tokens found for user: ${defaultUserId} (will validate on first use)`,
        );
      } else {
        this.logger.warn(
          `TIDAL not authenticated for user ${defaultUserId}. Sync will require manual authentication.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to check TIDAL tokens on startup: ${error.message}`,
      );
    }
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    // Generate a random code verifier (43-128 characters)
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
   * Get TIDAL authorization URL for OAuth2 PKCE flow
   * Returns both the URL and codeVerifier (needed for token exchange)
   */
  getAuthUrl(): { authUrl: string; codeVerifier: string } {
    if (!this.clientId) {
      throw new UnauthorizedException('TIDAL OAuth2 not configured');
    }

    const redirectUri = this.redirectUri || 'http://localhost:3000';
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    // Scopes per TIDAL API spec: https://tidal-music.github.io/tidal-api-reference/tidal-api-oas.json
    const scopes = [
      'playlists.read',
      'playlists.write',
      'user.read',
      'search.read',
    ].join(' ');

    this.logger.debug(
      `Generating TIDAL auth URL with client_id: ${this.clientId.substring(0, 5)}..., redirect_uri: ${redirectUri}`,
    );

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://login.tidal.com/authorize?${params.toString()}`;
    this.logger.debug(
      `TIDAL auth URL generated: ${authUrl.substring(0, 100)}...`,
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
    if (!this.clientId || !this.clientSecret) {
      throw new UnauthorizedException('TIDAL OAuth2 not configured');
    }

    const tokenUrl = 'https://auth.tidal.com/v1/oauth2/token';
    const redirectUri = this.redirectUri || 'http://localhost:3000';

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code_verifier: codeVerifier,
    });

    this.logger.debug(
      `Exchanging TIDAL authorization code. Redirect URI: ${redirectUri}, Code length: ${code.length}, Verifier length: ${codeVerifier.length}`,
    );

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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

        this.logger.error(`TIDAL token exchange error:`, {
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
            'Invalid client credentials. Please check your TIDAL_CLIENT_ID and TIDAL_CLIENT_SECRET.';
        } else if (errorData.error === 'redirect_uri_mismatch') {
          errorMessage = `Redirect URI mismatch. The redirect URI "${redirectUri}" must match exactly what's registered in your TIDAL Developer Portal.`;
        } else if (errorData.error_description) {
          errorMessage = errorData.error_description;
        }
      } catch {
        this.logger.error(`TIDAL token exchange error (raw): ${errorText}`);
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
          provider: 'tidal',
        },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(
        'TIDAL not authenticated. Please authorize first.',
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
      throw new UnauthorizedException('TIDAL OAuth2 not configured');
    }

    const tokenUrl = 'https://auth.tidal.com/v1/oauth2/token';

    // Match official TIDAL SDK: send client_id and client_secret in body
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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
          `TIDAL token refresh error: ${JSON.stringify(errorData)}`,
        );
      } catch {
        this.logger.error(`TIDAL token refresh error (raw): ${errorText}`);
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
          provider: 'tidal',
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
          provider: 'tidal',
        },
      },
      create: {
        userId,
        provider: 'tidal',
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: expiryDate,
        scope: 'tidal',
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

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new UnauthorizedException('TIDAL authentication failed');
      }
      const errorText = await response.text();
      this.logger.error(
        `TIDAL API error: ${response.status} - ${errorText} (endpoint: ${endpoint})`,
      );
      throw new Error(`TIDAL API error: ${response.status} - ${errorText}`);
    }

    // Handle empty responses (e.g., 204 No Content)
    const contentType = response.headers.get('content-type');
    const text = await response.text();

    if (!text || text.trim() === '') {
      // Empty response (204 No Content) - return null to indicate success
      return null;
    }

    // Try to parse JSON, but handle cases where response might not be JSON
    try {
      return JSON.parse(text);
    } catch (error) {
      // If it's not JSON but response was OK, return the text
      this.logger.debug(
        `TIDAL API response is not JSON, returning text (endpoint: ${endpoint})`,
      );
      return text;
    }
  }

  /**
   * Extract TIDAL track ID from URL
   */
  extractTrackIdFromUrl(url: string): string | null {
    // TIDAL URLs format: https://tidal.com/browse/track/{id}
    // or https://listen.tidal.com/track/{id}
    const match = url.match(/\/track\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Search for TIDAL tracks
   */
  async searchTracks(
    query: string,
    userId: string,
    limit: number = 25,
  ): Promise<TidalTrack[]> {
    this.logger.debug(
      `TIDAL API: Searching for "${query}" (1 API call: search)`,
    );

    try {
      // TIDAL search endpoint: /search with query parameters
      // Add delay to avoid rate limiting (429 errors)
      await this.delay(200); // 200ms delay between searches

      const response = await this.makeRequest(
        userId,
        `/search?query=${encodeURIComponent(query)}&limit=${limit}&types=tracks`,
        {
          method: 'GET',
        },
      );

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }

      // Find tracks in the response (JSON:API format)
      const tracks = response.data
        .filter((item: any) => item.type === 'tracks')
        .map((item: any) => {
          const attrs = item.attributes || {};
          const duration = this.parseDuration(attrs.duration || 'PT0S');

          // Extract artist name from relationships or attributes
          let artist = 'Unknown Artist';
          if (
            attrs.artists &&
            Array.isArray(attrs.artists) &&
            attrs.artists.length > 0
          ) {
            artist =
              attrs.artists[0].name || attrs.artists[0] || 'Unknown Artist';
          } else if (response.included) {
            // Check included resources for artist data
            const artistRef = item.relationships?.artists?.data?.[0];
            if (artistRef) {
              const artistData = response.included.find(
                (inc: any) => inc.type === 'artists' && inc.id === artistRef.id,
              );
              if (artistData?.attributes?.name) {
                artist = artistData.attributes.name;
              }
            }
          }

          return {
            id: item.id,
            title: attrs.title || '',
            artist,
            duration,
            isrc: attrs.isrc,
          };
        });

      return tracks;
    } catch (error) {
      this.logger.error(`Failed to search TIDAL tracks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse ISO 8601 duration to seconds
   */
  private parseDuration(duration: string): number {
    // Format: PT2M58S (2 minutes 58 seconds)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Find best matching track for a song
   * Strategy: exact match > fuzzy match + duration-based
   */
  async findBestMatch(
    artist: string,
    title: string,
    trackDuration: number, // in seconds
    userId: string,
  ): Promise<TrackMatchResult> {
    const searchQuery = `${artist} - ${title}`;
    const tracks = await this.searchTracks(searchQuery, userId, 5);

    if (tracks.length === 0) {
      return { trackId: null, confidence: 'none' };
    }

    // Normalize strings for comparison
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();

    const normalizedArtist = normalize(artist);
    const normalizedTitle = normalize(title);
    const searchTerms = `${normalizedArtist} ${normalizedTitle}`.split(/\s+/);

    // 1. Try exact match first
    for (const track of tracks) {
      const trackTitle = normalize(track.title);
      const trackArtist = normalize(track.artist);
      const trackTerms = `${trackArtist} ${trackTitle}`.split(/\s+/);

      // Check if all search terms are in track
      const allTermsMatch = searchTerms.every((term) =>
        trackTerms.some((tt) => tt.includes(term) || term.includes(tt)),
      );

      if (allTermsMatch) {
        // Check duration match (within 10 seconds tolerance)
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

    // 2. Fuzzy match with duration-based scoring
    let bestMatch: TidalTrack | null = null;
    let bestScore = 0;

    for (const track of tracks) {
      const trackTitle = normalize(track.title);
      const trackArtist = normalize(track.artist);
      let score = 0;

      // Title matching score
      const titleWords = normalizedTitle.split(/\s+/);
      const matchedTitleWords = titleWords.filter((word) =>
        trackTitle.includes(word),
      );
      score += (matchedTitleWords.length / titleWords.length) * 0.5;

      // Artist matching score
      const artistWords = normalizedArtist.split(/\s+/);
      const matchedArtistWords = artistWords.filter((word) =>
        trackArtist.includes(word),
      );
      score += (matchedArtistWords.length / artistWords.length) * 0.3;

      // Duration matching score (closer = better, max 0.2 points)
      const durationDiff = Math.abs(track.duration - trackDuration);
      const durationScore = Math.max(0, 0.2 - durationDiff / 100);
      score += durationScore;

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

  /**
   * Create a TIDAL playlist
   */
  async createTidalPlaylist(
    userId: string,
    name: string,
    description?: string,
  ): Promise<string> {
    this.logger.log(
      `TIDAL API: Creating playlist "${name}" (1 API call: POST /playlists)`,
    );

    try {
      // TIDAL API expects 'name' not 'title' in attributes
      const requestBody = {
        data: {
          type: 'playlists',
          attributes: {
            name: name, // Use 'name' instead of 'title'
            description: description || `Playlist synced from Muzo`,
          },
        },
      };

      this.logger.debug(
        `Creating playlist with body: ${JSON.stringify(requestBody)}`,
      );

      const response = await this.makeRequest(userId, '/playlists', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const playlistId = response.data?.id;
      if (!playlistId) {
        this.logger.error(
          `Failed to create playlist - response: ${JSON.stringify(response)}`,
        );
        throw new Error('Failed to create playlist - no ID returned');
      }

      this.logger.debug(`Playlist created successfully with ID: ${playlistId}`);
      return playlistId;
    } catch (error) {
      this.logger.error(`Failed to create TIDAL playlist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper method to add delay (for rate limiting)
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Add tracks to TIDAL playlist
   * TIDAL API allows up to 20 tracks per request (maxItems: 20)
   */
  async addTracksToPlaylist(
    userId: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void> {
    const maxItemsPerRequest = 20;
    const batches = Math.ceil(trackIds.length / maxItemsPerRequest);

    this.logger.log(
      `TIDAL API: Adding ${trackIds.length} tracks to playlist (${batches} batch requests: POST /playlists/{id}/relationships/items)`,
    );

    // Process tracks in batches of 20 (TIDAL API limit)
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const startIndex = batchIndex * maxItemsPerRequest;
      const endIndex = Math.min(
        startIndex + maxItemsPerRequest,
        trackIds.length,
      );
      const batchTrackIds = trackIds.slice(startIndex, endIndex);

      try {
        // Build data array using map
        const data = batchTrackIds.map((trackId) => ({
          type: 'tracks' as const,
          id: trackId,
          // Optional: meta with addedAt timestamp
          meta: {
            addedAt: new Date().toISOString(),
          },
        }));

        // TIDAL API endpoint for adding tracks: /playlists/{id}/relationships/items
        // Schema: data is an array of objects with type and id (required)
        await this.makeRequest(
          userId,
          `/playlists/${playlistId}/relationships/items`,
          {
            method: 'POST',
            body: JSON.stringify({
              data,
              // Optional: meta with positionBefore (if needed for positioning)
            }),
          },
        );

        // Small delay between batch requests to avoid rate limits
        if (batchIndex < batches - 1) {
          await this.delay(100); // 100ms delay between batches
        }
      } catch (error) {
        this.logger.error(
          `Failed to add batch ${batchIndex + 1}/${batches} to playlist: ${error.message}`,
        );
        throw error;
      }
    }
  }
}
