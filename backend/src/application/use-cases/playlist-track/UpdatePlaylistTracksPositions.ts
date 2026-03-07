import { NotFoundException } from '@nestjs/common';
import { PlaylistId } from 'src/kernel/ids';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';
import {
  IPlaylistTrackRepository,
  UpdatePositionsData,
} from '../../ports/repositories/IPlaylistTrackRepository';

export class UpdatePlaylistTracksPositionsUseCase {
  constructor(
    private readonly playlistTrackRepository: IPlaylistTrackRepository,

    private readonly playlistRepository: IPlaylistRepository,
  ) {}

  async execute(playlistId: PlaylistId, positions: UpdatePositionsData[]): Promise<boolean> {
    // Verify playlist access
    await this.playlistRepository.verifyAccess(playlistId);

    // Validate all tracks exist in playlist
    const trackIds = positions.map((p) => p.id);
    const existingItems = await this.playlistTrackRepository.getTracksByPlaylistId(playlistId);

    if (existingItems.length !== trackIds.length) {
      const existingTrackIds = existingItems.map((item) => item.id);
      const missingTrackIds = trackIds.filter((id) => !existingTrackIds.includes(id));
      throw new NotFoundException(`Tracks not found in playlist: ${missingTrackIds.join(', ')}`);
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
