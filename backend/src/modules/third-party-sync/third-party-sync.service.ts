import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlaylistService } from '../playlist/playlist.service';
import { SpotifyService } from './services/spotify.service';
import { TidalService } from './services/tidal.service';
import { YoutubeService } from './services/youtube.service';
import { Id3ReaderService } from './utils/id3-reader.service';

export interface SyncResult {
  success: boolean;
  playlistId?: string;
  playlistUrl?: string;
  syncedCount: number;
  skippedCount: number;
  errors: string[];
}

@Injectable()
export class ThirdPartySyncService {
  private readonly logger = new Logger(ThirdPartySyncService.name);

  constructor(
    private readonly playlistService: PlaylistService,
    private readonly youtubeService: YoutubeService,
    private readonly tidalService: TidalService,
    private readonly spotifyService: SpotifyService,
    private readonly id3Reader: Id3ReaderService,
  ) {}

  /**
   * Sync playlist to YouTube
   */
  async syncPlaylistToYouTube(
    playlistId: string,
    userId: string,
  ): Promise<SyncResult> {
    this.logger.log(`Starting YouTube sync for playlist ${playlistId}`);

    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    try {
      // Fetch playlist with tracks
      const playlist = await this.playlistService.findPlaylistById(playlistId);

      if (!playlist) {
        throw new NotFoundException(`Playlist ${playlistId} not found`);
      }

      // Check if user has YouTube authentication
      try {
        await this.youtubeService.getAccessToken(userId);
      } catch (error) {
        throw new UnauthorizedException(
          'YouTube not authenticated. Please authorize first.',
        );
      }

      // Collect video IDs for all tracks
      const videoIds: string[] = [];
      const trackErrors: string[] = [];

      for (const playlistTrack of playlist.tracks) {
        const track = playlistTrack.track;
        let videoId: string | null = null;

        try {
          // Try to get YouTube URL from ID3 tags (purl)
          const id3Tags = await this.id3Reader.readId3Tags(track.filePath);
          const purl = id3Tags.purl;

          if (purl) {
            // Extract video ID from URL
            videoId = this.youtubeService.extractVideoIdFromUrl(purl);
          }

          // If no video ID from purl, search YouTube
          if (!videoId) {
            const artist =
              track.userArtist ||
              track.originalArtist ||
              track.aiArtist ||
              'Unknown Artist';
            const title =
              track.userTitle ||
              track.originalTitle ||
              track.aiTitle ||
              'Unknown Title';

            const matchResult = await this.youtubeService.findBestMatch(
              artist,
              title,
              track.duration || 0,
              userId,
            );

            if (matchResult.videoId) {
              videoId = matchResult.videoId;
              this.logger.log(
                `Found match for "${artist} - ${title}": ${matchResult.confidence} confidence`,
              );
            } else {
              trackErrors.push(`No match found for "${artist} - ${title}"`);
              result.skippedCount++;
              continue;
            }
          }

          if (videoId) {
            videoIds.push(videoId);
            result.syncedCount++;
          }
        } catch (error) {
          const trackName = `${track.originalArtist || 'Unknown'} - ${track.originalTitle || 'Unknown'}`;
          const errorMsg = `Failed to process track "${trackName}": ${error.message}`;
          this.logger.error(errorMsg);
          trackErrors.push(errorMsg);
          result.skippedCount++;
        }
      }

      if (videoIds.length === 0) {
        result.errors.push('No videos found to sync');
        return result;
      }

      // Create YouTube playlist
      const youtubePlaylistId = await this.youtubeService.createPlaylist(
        userId,
        playlist.name,
        playlist.description || undefined,
      );

      // Add videos to playlist
      await this.youtubeService.addVideosToPlaylist(
        userId,
        youtubePlaylistId,
        videoIds,
      );

      result.success = true;
      result.playlistId = youtubePlaylistId;
      result.playlistUrl = `https://www.youtube.com/playlist?list=${youtubePlaylistId}`;
      result.errors = trackErrors;

      this.logger.log(
        `Successfully synced playlist to YouTube: ${result.syncedCount} tracks synced, ${result.skippedCount} skipped`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to sync playlist to YouTube: ${error.message}`);
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Get YouTube OAuth authorization URL
   */
  getYouTubeAuthUrl(): string {
    return this.youtubeService.getAuthUrl();
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeYouTubeCode(
    code: string,
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.youtubeService.exchangeCodeForTokens(code, userId);
  }

  /**
   * Sync playlist to TIDAL
   */
  async syncPlaylistToTidal(
    playlistId: string,
    userId: string,
  ): Promise<SyncResult> {
    this.logger.log(`Starting TIDAL sync for playlist ${playlistId}`);

    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    try {
      // Fetch playlist with tracks
      const playlist = await this.playlistService.findPlaylistById(playlistId);

      if (!playlist) {
        throw new NotFoundException(`Playlist ${playlistId} not found`);
      }

      // Check if user has TIDAL authentication
      try {
        await this.tidalService.getAccessToken(userId);
      } catch (error) {
        throw new UnauthorizedException(
          'TIDAL not authenticated. Please authorize first.',
        );
      }

      // Collect track IDs for all tracks
      const trackIds: string[] = [];
      const trackErrors: string[] = [];

      for (const playlistTrack of playlist.tracks) {
        const track = playlistTrack.track;
        let trackId: string | null = null;

        try {
          // Try to get TIDAL URL from ID3 tags (url)
          const id3Tags = await this.id3Reader.readId3Tags(track.filePath);
          const tidalUrl = id3Tags.url;

          if (tidalUrl) {
            // Extract track ID from URL
            trackId = this.tidalService.extractTrackIdFromUrl(tidalUrl);
          }

          // If no track ID from url, search TIDAL
          if (!trackId) {
            const artist =
              track.userArtist ||
              track.originalArtist ||
              track.aiArtist ||
              'Unknown Artist';
            const title =
              track.userTitle ||
              track.originalTitle ||
              track.aiTitle ||
              'Unknown Title';

            const matchResult = await this.tidalService.findBestMatch(
              artist,
              title,
              track.duration || 0,
              userId,
            );

            if (matchResult.trackId) {
              trackId = matchResult.trackId;
              this.logger.log(
                `Found match for "${artist} - ${title}": ${matchResult.confidence} confidence`,
              );
            } else {
              trackErrors.push(`No match found for "${artist} - ${title}"`);
              result.skippedCount++;
              continue;
            }
          }

          if (trackId) {
            trackIds.push(trackId);
            result.syncedCount++;
          }
        } catch (error) {
          const trackName = `${track.originalArtist || 'Unknown'} - ${track.originalTitle || 'Unknown'}`;
          const errorMsg = `Failed to process track "${trackName}": ${error.message}`;
          this.logger.error(errorMsg);
          trackErrors.push(errorMsg);
          result.skippedCount++;
        }
      }

      if (trackIds.length === 0) {
        result.errors.push('No tracks found to sync');
        return result;
      }

      // Create TIDAL playlist
      const tidalPlaylistId = await this.tidalService.createTidalPlaylist(
        userId,
        playlist.name,
        playlist.description || undefined,
      );

      // Add tracks to playlist
      await this.tidalService.addTracksToPlaylist(
        userId,
        tidalPlaylistId,
        trackIds,
      );

      result.success = true;
      result.playlistId = tidalPlaylistId;
      result.playlistUrl = `https://tidal.com/browse/playlist/${tidalPlaylistId}`;
      result.errors = trackErrors;

      this.logger.log(
        `TIDAL sync completed: ${result.syncedCount} synced, ${result.skippedCount} skipped`,
      );

      return result;
    } catch (error) {
      this.logger.error(`TIDAL sync failed: ${error.message}`);
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Get TIDAL authorization URL (with PKCE codeVerifier)
   */
  getTidalAuthUrl(): { authUrl: string; codeVerifier: string } {
    return this.tidalService.getAuthUrl();
  }

  /**
   * Exchange TIDAL authorization code for tokens
   * Note: TIDAL uses PKCE, so we need codeVerifier
   */
  async exchangeTidalCode(
    code: string,
    codeVerifier: string,
    userId: string,
  ): Promise<void> {
    await this.tidalService.exchangeCodeForTokens(code, codeVerifier, userId);
  }

  /**
   * Sync playlist to Spotify
   */
  async syncPlaylistToSpotify(
    playlistId: string,
    userId: string,
  ): Promise<SyncResult> {
    this.logger.log(`Starting Spotify sync for playlist ${playlistId}`);

    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    try {
      // Fetch playlist with tracks
      const playlist = await this.playlistService.findPlaylistById(playlistId);

      if (!playlist) {
        throw new NotFoundException(`Playlist ${playlistId} not found`);
      }

      // Check if user has Spotify authentication
      try {
        await this.spotifyService.getAccessToken(userId);
      } catch (error) {
        throw new UnauthorizedException(
          'Spotify not authenticated. Please authorize first.',
        );
      }

      // Collect track IDs for all tracks
      const trackIds: string[] = [];
      const trackErrors: string[] = [];

      for (const playlistTrack of playlist.tracks) {
        const track = playlistTrack.track;
        let trackId: string | null = null;

        try {
          // Try to get Spotify URL from ID3 tags (url)
          const id3Tags = await this.id3Reader.readId3Tags(track.filePath);
          const spotifyUrl = id3Tags.url;

          if (spotifyUrl) {
            // Extract track ID from URL
            trackId = this.spotifyService.extractTrackIdFromUrl(spotifyUrl);
          }

          // If no track ID from url, search Spotify
          if (!trackId) {
            const artist =
              track.userArtist ||
              track.originalArtist ||
              track.aiArtist ||
              'Unknown Artist';
            const title =
              track.userTitle ||
              track.originalTitle ||
              track.aiTitle ||
              'Unknown Title';

            const matchResult = await this.spotifyService.findBestMatch(
              artist,
              title,
              track.duration || 0,
              userId,
            );

            if (matchResult.trackId) {
              trackId = matchResult.trackId;
              this.logger.log(
                `Found match for "${artist} - ${title}": ${matchResult.confidence} confidence`,
              );
            } else {
              trackErrors.push(`No match found for "${artist} - ${title}"`);
              result.skippedCount++;
              continue;
            }
          }

          if (trackId) {
            trackIds.push(trackId);
            result.syncedCount++;
          }
        } catch (error) {
          const trackName = `${track.originalArtist || 'Unknown'} - ${track.originalTitle || 'Unknown'}`;
          const errorMsg = `Failed to process track "${trackName}": ${error.message}`;
          this.logger.error(errorMsg);
          trackErrors.push(errorMsg);
          result.skippedCount++;
        }
      }

      if (trackIds.length === 0) {
        result.errors.push('No tracks found to sync');
        return result;
      }

      // Create Spotify playlist
      const spotifyPlaylistId = await this.spotifyService.createSpotifyPlaylist(
        userId,
        playlist.name,
        playlist.description || undefined,
      );

      // Add tracks to playlist
      await this.spotifyService.addTracksToPlaylist(
        userId,
        spotifyPlaylistId,
        trackIds,
      );

      result.success = true;
      result.playlistId = spotifyPlaylistId;
      result.playlistUrl = `https://open.spotify.com/playlist/${spotifyPlaylistId}`;
      result.errors = trackErrors;

      this.logger.log(
        `Spotify sync completed: ${result.syncedCount} synced, ${result.skippedCount} skipped`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Spotify sync failed: ${error.message}`);
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Get Spotify authorization URL (with PKCE codeVerifier)
   */
  getSpotifyAuthUrl(): { authUrl: string; codeVerifier: string } {
    return this.spotifyService.getAuthUrl();
  }

  /**
   * Exchange Spotify authorization code for tokens
   * Note: Spotify uses PKCE, so we need codeVerifier
   */
  async exchangeSpotifyCode(
    code: string,
    codeVerifier: string,
    userId: string,
  ): Promise<void> {
    await this.spotifyService.exchangeCodeForTokens(code, codeVerifier, userId);
  }
}
