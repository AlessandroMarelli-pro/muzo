import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
} from '../../ports/repositories/IPlaylistRepository';
import {
  IPlaylistTrackRepository,
  PLAYLIST_TRACK_REPOSITORY,
  UpdatePositionsData,
} from '../../ports/repositories/IPlaylistTrackRepository';

@Injectable()
export class UpdatePlaylistTracksPositionsUseCase {
  constructor(
    @Inject(PLAYLIST_TRACK_REPOSITORY)
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
  ) {}

  async execute(
    playlistId: PlaylistId,
    positions: UpdatePositionsData[],
  ): Promise<boolean> {
    // Verify playlist access
    await this.playlistRepository.verifyAccess(playlistId);

    // Validate all tracks exist in playlist
    const trackIds = positions.map((p) => p.id);
    const existingItems =
      await this.playlistTrackRepository.getTracksByPlaylistId(playlistId);

    if (existingItems.length !== trackIds.length) {
      const existingTrackIds = existingItems.map((item) => item.id);
      const missingTrackIds = trackIds.filter(
        (id) => !existingTrackIds.includes(id),
      );
      throw new NotFoundException(
        `Tracks not found in playlist: ${missingTrackIds.join(', ')}`,
      );
    }

    // Update positions
    const updatePromises = positions.map(({ id, position }) =>
      this.playlistTrackRepository.updateOneById(id, {
        position,
      }),
    );
    await Promise.all(updatePromises);
    return true;
  }
}
