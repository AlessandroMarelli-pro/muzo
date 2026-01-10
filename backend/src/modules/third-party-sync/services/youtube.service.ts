import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { PrismaService } from '../../../shared/services/prisma.service';
import { Id3ReaderService } from '../utils/id3-reader.service';

export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  duration: number; // in seconds
  publishedAt: string;
}

export interface VideoMatchResult {
  videoId: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
  matchedVideo?: YouTubeVideo;
}

@Injectable()
export class YoutubeService implements OnModuleInit {
  private readonly logger = new Logger(YoutubeService.name);
  private oauth2Client: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly id3Reader: Id3ReaderService,
  ) {
    this.initializeOAuth2();
  }

  /**
   * Initialize on module startup - check for tokens (no API calls to save quota)
   */
  async onModuleInit() {
    const defaultUserId = this.configService.get<string>(
      'YOUTUBE_DEFAULT_USER_ID',
      'default',
    );

    try {
      // Just check if tokens exist, don't validate with API call (saves quota)
      const tokenRecord = await this.prisma.thirdPartyOAuthToken.findUnique({
        where: {
          userId_provider: {
            userId: defaultUserId,
            provider: 'youtube',
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
              `Failed to refresh YouTube token on startup: ${error.message}`,
            );
          });
        }

        this.logger.log(
          `YouTube tokens found for user: ${defaultUserId} (will validate on first use)`,
        );
      } else {
        this.logger.warn(
          `YouTube not authenticated for user ${defaultUserId}. Sync will require manual authentication.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to check YouTube tokens on startup: ${error.message}`,
      );
    }
  }

  private initializeOAuth2() {
    const clientId = this.configService.get<string>('YOUTUBE_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'YOUTUBE_CLIENT_SECRET',
    );
    const redirectUri = this.configService.get<string>('YOUTUBE_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.warn(
        'YouTube OAuth2 credentials not configured. YouTube sync will not work.',
      );
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );
  }

  /**
   * Get OAuth2 authorization URL
   */
  getAuthUrl(): string {
    if (!this.oauth2Client) {
      throw new UnauthorizedException('YouTube OAuth2 not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!this.oauth2Client) {
      throw new UnauthorizedException('YouTube OAuth2 not configured');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    if (!accessToken) {
      throw new UnauthorizedException('Failed to get access token');
    }

    // Store tokens in database
    await this.saveTokens(
      userId,
      accessToken,
      refreshToken,
      tokens.expiry_date,
    );

    return { accessToken, refreshToken: refreshToken || '' };
  }

  /**
   * Validate and refresh tokens for a user (used on startup)
   */
  async validateAndRefreshTokens(userId: string): Promise<boolean> {
    const tokenRecord = await this.prisma.thirdPartyOAuthToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'youtube',
        },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(
        `No YouTube tokens found for user ${userId}`,
      );
    }

    // If token is expired or will expire soon (within 5 minutes), refresh it
    const expiresSoon =
      tokenRecord.expiresAt &&
      tokenRecord.expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

    if (expiresSoon || !tokenRecord.expiresAt) {
      if (!tokenRecord.refreshToken) {
        throw new UnauthorizedException('No refresh token available');
      }

      try {
        await this.refreshAccessToken(userId, tokenRecord.refreshToken);
        this.logger.log(`Refreshed YouTube access token for user ${userId}`);
      } catch (error) {
        this.logger.error(
          `Failed to refresh YouTube token for user ${userId}: ${error.message}`,
        );
        throw error;
      }
    }

    // Test the token by making a simple API call
    try {
      const accessToken = await this.getAccessToken(userId);
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      // Make a simple API call to validate the token
      const youtube = google.youtube({
        version: 'v3',
        auth: this.oauth2Client,
      });

      await youtube.channels.list({
        part: ['snippet'],
        mine: true,
        maxResults: 1,
      });

      return true;
    } catch (error) {
      this.logger.error(
        `YouTube token validation failed for user ${userId}: ${error.message}`,
      );
      throw new UnauthorizedException('Invalid or expired YouTube token');
    }
  }

  /**
   * Get or refresh access token for user
   */
  async getAccessToken(userId: string): Promise<string> {
    const tokenRecord = await this.prisma.thirdPartyOAuthToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'youtube',
        },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(
        'YouTube not authenticated. Please authorize first.',
      );
    }

    // Check if token is expired
    if (tokenRecord.expiresAt && tokenRecord.expiresAt.getTime() < Date.now()) {
      // Refresh token
      return this.refreshAccessToken(userId, tokenRecord.refreshToken);
    }

    return tokenRecord.accessToken;
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(
    userId: string,
    refreshToken: string | null,
  ): Promise<string> {
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token available');
    }

    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await this.oauth2Client.refreshAccessToken();
    const newAccessToken = credentials.access_token;

    // Update stored token
    await this.prisma.thirdPartyOAuthToken.update({
      where: {
        userId_provider: {
          userId,
          provider: 'youtube',
        },
      },
      data: {
        accessToken: newAccessToken,
        expiresAt: credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : null,
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
    expiryDate: number | null,
  ) {
    await this.prisma.thirdPartyOAuthToken.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'youtube',
        },
      },
      create: {
        userId,
        provider: 'youtube',
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: expiryDate ? new Date(expiryDate) : null,
        scope: 'youtube',
      },
      update: {
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: expiryDate ? new Date(expiryDate) : null,
      },
    });
  }

  /**
   * Set OAuth2 client credentials for API calls
   */
  private async setAuthCredentials(userId: string) {
    const accessToken = await this.getAccessToken(userId);
    this.oauth2Client.setCredentials({
      access_token: accessToken,
    });
  }

  /**
   * Search for YouTube video by query
   * Returns top 5 results
   * Uses OAuth2 authentication (requires userId for token)
   */
  async searchVideos(
    query: string,
    userId: string,
    maxResults: number = 5,
  ): Promise<YouTubeVideo[]> {
    // Use OAuth2 for search (consistent with other operations)
    await this.setAuthCredentials(userId);

    const youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });

    this.logger.debug(
      `YouTube API: Searching for "${query}" (2 API calls: search.list + videos.list)`,
    );

    try {
      // Optimize: Get both search results and video details in one call by including contentDetails in search
      // However, search.list doesn't support contentDetails, so we still need videos.list
      // But we can optimize by requesting only what we need
      const response = await youtube.search.list({
        part: ['snippet', 'id'],
        q: query,
        type: ['video'],
        maxResults,
        order: 'relevance',
      });

      if (!response.data.items || response.data.items.length === 0) {
        return [];
      }

      // Get video details to get duration
      const videoIds = response.data.items
        .map((item) => item.id?.videoId)
        .filter((id): id is string => !!id);

      if (videoIds.length === 0) {
        return [];
      }

      // Get video details including duration - batch request for all videos at once
      const videoDetails = await youtube.videos.list({
        part: ['contentDetails', 'snippet'],
        id: videoIds, // Batch request - all videos in one call
      });

      return (videoDetails.data.items || []).map((item) => {
        const duration = this.parseDuration(
          item.contentDetails?.duration || 'PT0S',
        );
        return {
          id: item.id || '',
          title: item.snippet?.title || '',
          channelTitle: item.snippet?.channelTitle || '',
          duration,
          publishedAt: item.snippet?.publishedAt || '',
        };
      });
    } catch (error) {
      this.logger.error(`Failed to search YouTube videos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find best matching video for a track
   * Strategy: exact match > fuzzy match + duration-based
   */
  async findBestMatch(
    artist: string,
    title: string,
    trackDuration: number, // in seconds
    userId: string,
  ): Promise<VideoMatchResult> {
    const searchQuery = `${artist} - ${title}`;
    const videos = await this.searchVideos(searchQuery, userId, 5);

    if (videos.length === 0) {
      return { videoId: null, confidence: 'none' };
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
    for (const video of videos) {
      const videoTitle = normalize(video.title);
      const videoTerms = videoTitle.split(/\s+/);

      // Check if all search terms are in video title
      const allTermsMatch = searchTerms.every((term) =>
        videoTerms.some((vt) => vt.includes(term) || term.includes(vt)),
      );

      if (allTermsMatch) {
        // Check duration match (within 10 seconds tolerance)
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

    // 2. Fuzzy match with duration-based scoring
    let bestMatch: YouTubeVideo | null = null;
    let bestScore = 0;

    for (const video of videos) {
      const videoTitle = normalize(video.title);
      let score = 0;

      // Title matching score
      const titleWords = normalizedTitle.split(/\s+/);
      const matchedTitleWords = titleWords.filter((word) =>
        videoTitle.includes(word),
      );
      score += (matchedTitleWords.length / titleWords.length) * 0.5;

      // Artist matching score
      const artistWords = normalizedArtist.split(/\s+/);
      const matchedArtistWords = artistWords.filter((word) =>
        videoTitle.includes(word),
      );
      score += (matchedArtistWords.length / artistWords.length) * 0.3;

      // Duration matching score (closer = better, max 0.2 points)
      const durationDiff = Math.abs(video.duration - trackDuration);
      const durationScore = Math.max(0, 0.2 - durationDiff / 100);
      score += durationScore;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = video;
      }
    }

    if (bestMatch && bestScore > 0.3) {
      // Minimum threshold for fuzzy match
      return {
        videoId: bestMatch.id,
        confidence: 'fuzzy',
        matchedVideo: bestMatch,
      };
    }

    return { videoId: null, confidence: 'none' };
  }

  /**
   * Extract YouTube video ID from URL
   */
  extractVideoIdFromUrl(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Create YouTube playlist
   */
  async createPlaylist(
    userId: string,
    name: string,
    description?: string,
  ): Promise<string> {
    await this.setAuthCredentials(userId);

    const youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });

    try {
      const response = await youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: name,
            description: description || `Playlist synced from Muzo`,
          },
          status: {
            privacyStatus: 'private', // Can be changed to 'public' or 'unlisted'
          },
        },
      });

      const playlistId = response.data.id;
      if (!playlistId) {
        throw new Error('Failed to create playlist');
      }

      return playlistId;
    } catch (error) {
      this.logger.error(`Failed to create YouTube playlist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add videos to YouTube playlist
   */
  async addVideosToPlaylist(
    userId: string,
    playlistId: string,
    videoIds: string[],
  ): Promise<void> {
    await this.setAuthCredentials(userId);

    const youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });

    this.logger.log(
      `YouTube API: Adding ${videoIds.length} videos to playlist (${videoIds.length} API calls: playlistItems.insert)`,
    );

    // Add videos one by one (YouTube API limitation)
    // Add small delay between requests to avoid rate limiting
    for (let i = 0; i < videoIds.length; i++) {
      const videoId = videoIds[i];
      try {
        await youtube.playlistItems.insert({
          part: ['snippet'],
          requestBody: {
            snippet: {
              playlistId,
              resourceId: {
                kind: 'youtube#video',
                videoId,
              },
            },
          },
        });

        // Small delay between requests (except for last one) to avoid rate limits
        if (i < videoIds.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
        }
      } catch (error) {
        this.logger.warn(
          `Failed to add video ${videoId} to playlist: ${error.message}`,
        );
        // Continue with other videos even if one fails
      }
    }
  }

  /**
   * Parse ISO 8601 duration to seconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }
}
