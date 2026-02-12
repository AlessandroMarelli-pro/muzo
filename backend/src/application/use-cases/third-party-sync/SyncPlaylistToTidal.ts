import { PlaylistId } from 'src/kernel/ids';
import type { SyncResult } from '../../ports/dtos/SyncResult';
import type { IId3Reader } from '../../ports/infrastructure/IId3Reader';
import type { ITidalSyncProvider } from '../../ports/infrastructure/ITidalSyncProvider';
import type { GetPlaylistUseCase } from '../playlist/GetPlaylist';

export class SyncPlaylistToTidalUseCase {
  constructor(
    private readonly getPlaylistUseCase: GetPlaylistUseCase,
    private readonly tidalProvider: ITidalSyncProvider,
    private readonly id3Reader: IId3Reader,
  ) {}

  async execute(playlistId: PlaylistId, userId: string): Promise<SyncResult> {
    const playlist = await this.getPlaylistUseCase.execute(playlistId);
    await this.tidalProvider.getAccessToken(userId);

    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    const trackIds: string[] = [];
    const trackErrors: string[] = [];

    const tracks = playlist.tracks ?? [];
    for (const playlistTrack of tracks) {
      const track = playlistTrack.track;
      let trackId: string | null = null;
      try {
        const filePath = track.fileInfo?.filePath ?? '';
        const id3Tags = await this.id3Reader.readId3Tags(filePath);
        if (id3Tags.url) {
          trackId = this.tidalProvider.extractTrackIdFromUrl(id3Tags.url);
        }
        const artist = track.artist ?? 'Unknown Artist';
        const title = track.title ?? 'Unknown Title';
        const duration =
          track.technicalInfo?.duration ?? track.metadata?.duration ?? 0;
        if (!trackId) {
          const matchResult = await this.tidalProvider.findBestMatch(
            artist,
            title,
            duration,
            userId,
          );
          if (matchResult.trackId) {
            trackId = matchResult.trackId;
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const trackName = `${track.artist ?? 'Unknown'} - ${track.title ?? 'Unknown'}`;
        trackErrors.push(`Failed to process track "${trackName}": ${msg}`);
        result.skippedCount++;
      }
    }

    if (trackIds.length === 0) {
      result.errors.push('No tracks found to sync');
      return result;
    }

    const tidalPlaylistId = await this.tidalProvider.createPlaylist(
      userId,
      playlist.name,
      playlist.description ?? undefined,
    );
    await this.tidalProvider.addTracksToPlaylist(
      userId,
      tidalPlaylistId,
      trackIds,
    );

    result.success = true;
    result.playlistId = tidalPlaylistId;
    result.playlistUrl = `https://tidal.com/browse/playlist/${tidalPlaylistId}`;
    result.errors = trackErrors;
    return result;
  }
}
