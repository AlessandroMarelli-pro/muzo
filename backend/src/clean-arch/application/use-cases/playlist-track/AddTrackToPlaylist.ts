import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { createConflictError } from 'src/clean-arch/kernel/types/errors';
import { PlaylistTrack } from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';
import {
  AddTrackToPlaylistData,
  IPlaylistTrackRepository,
} from '../../ports/repositories/IPlaylistTrackRepository';

export class AddTrackToPlaylistUseCase {
  constructor(
    private readonly playlistTrackRepository: IPlaylistTrackRepository,

    private readonly playlistRepository: IPlaylistRepository,

    private readonly musicTrackRepository: IMusicTrackRepository,
  ) {}

  async execute(
    playlistId: PlaylistId,
    addTrackDto: AddTrackToPlaylistData,
  ): Promise<PlaylistTrack> {
    // Verify playlist access
    await this.playlistRepository.verifyAccess(playlistId);

    // Check if track exists
    await this.musicTrackRepository.verifyExistence(addTrackDto.trackId);

    // Check if track is already in playlist
    const existingPlaylistTrack =
      await this.playlistTrackRepository.verifyPresence(
        playlistId,
        addTrackDto.trackId,
      );

    if (existingPlaylistTrack) {
      throw createConflictError('Track is already in this playlist');
    }
    // Get the next position
    const lastPosition =
      await this.playlistTrackRepository.getLastPosition(playlistId);

    const nextPosition = (lastPosition ?? 0) + 1;
    const playlistTrack = models.playlistTrack.instantiateNew({
      playlistId,
      trackId: addTrackDto.trackId,
      position: addTrackDto.position ?? nextPosition,
      addedAt: new Date(),
    });
    return this.playlistTrackRepository.save(playlistTrack);
  }
}
