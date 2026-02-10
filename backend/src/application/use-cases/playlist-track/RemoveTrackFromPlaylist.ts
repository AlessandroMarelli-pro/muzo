import { MusicTrackId, PlaylistId } from 'src/kernel/ids';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';

export class RemoveTrackFromPlaylistUseCase {
  constructor(
    private readonly playlistTrackRepository: IPlaylistTrackRepository,

    private readonly playlistRepository: IPlaylistRepository,
  ) {}

  async execute(
    playlistId: PlaylistId,
    trackId: MusicTrackId,
  ): Promise<boolean> {
    await this.playlistRepository.verifyAccess(playlistId);

    const removedPosition =
      await this.playlistTrackRepository.removeTrackFromPlaylist(
        playlistId,
        trackId,
      );

    return this.playlistTrackRepository.decrementTracksPosition(
      playlistId,
      removedPosition.position,
    );
  }
}
