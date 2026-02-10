import { PlaylistId } from 'src/kernel/ids';
import type { SyncResult } from '../../ports/dtos/SyncResult';
import type { IId3Reader } from '../../ports/infrastructure/IId3Reader';
import type { IYouTubeSyncProvider } from '../../ports/infrastructure/IYouTubeSyncProvider';
import type { GetPlaylistUseCase } from '../playlist/GetPlaylist';

export class SyncPlaylistToYouTubeUseCase {
  constructor(
    private readonly getPlaylistUseCase: GetPlaylistUseCase,
    private readonly youtubeProvider: IYouTubeSyncProvider,
    private readonly id3Reader: IId3Reader,
  ) {}

  async execute(playlistId: PlaylistId, userId: string): Promise<SyncResult> {
    const playlist = await this.getPlaylistUseCase.execute(playlistId);
    await this.youtubeProvider.getAccessToken(userId);

    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    const videoIds: string[] = [];
    const trackErrors: string[] = [];

    for (const playlistTrack of playlist.tracks) {
      const track = playlistTrack.track;
      let videoId: string | null = null;
      try {
        const filePath = track.fileInfo?.filePath ?? '';
        const id3Tags = await this.id3Reader.readId3Tags(filePath);
        if (id3Tags.purl) {
          videoId = this.youtubeProvider.extractVideoIdFromUrl(id3Tags.purl);
        }
        const artist = track.artist ?? 'Unknown Artist';
        const title = track.title ?? 'Unknown Title';
        const duration =
          track.technicalInfo?.duration ?? track.metadata?.duration ?? 0;
        if (!videoId) {
          const matchResult = await this.youtubeProvider.findBestMatch(
            artist,
            title,
            duration,
            userId,
          );
          if (matchResult.videoId) {
            videoId = matchResult.videoId;
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const trackName = `${track.artist ?? 'Unknown'} - ${track.title ?? 'Unknown'}`;
        trackErrors.push(`Failed to process track "${trackName}": ${msg}`);
        result.skippedCount++;
      }
    }

    if (videoIds.length === 0) {
      result.errors.push('No videos found to sync');
      return result;
    }

    const youtubePlaylistId = await this.youtubeProvider.createPlaylist(
      userId,
      playlist.name,
      playlist.description ?? undefined,
    );
    await this.youtubeProvider.addVideosToPlaylist(
      userId,
      youtubePlaylistId,
      videoIds,
    );

    result.success = true;
    result.playlistId = youtubePlaylistId;
    result.playlistUrl = `https://www.youtube.com/playlist?list=${youtubePlaylistId}`;
    result.errors = trackErrors;
    return result;
  }
}
