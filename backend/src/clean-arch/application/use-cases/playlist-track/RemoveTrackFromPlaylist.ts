import { Inject, Injectable } from '@nestjs/common';
import { MusicTrackId, PlaylistId } from 'src/clean-arch/kernel/ids';
import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
} from '../../ports/repositories/IPlaylistRepository';
import {
  IPlaylistTrackRepository,
  PLAYLIST_TRACK_REPOSITORY,
} from '../../ports/repositories/IPlaylistTrackRepository';

@Injectable()
export class RemoveTrackFromPlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_TRACK_REPOSITORY)
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
    @Inject(PLAYLIST_REPOSITORY)
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
