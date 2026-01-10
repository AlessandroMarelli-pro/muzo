import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlaylistService } from '../playlist/playlist.service';
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
}
