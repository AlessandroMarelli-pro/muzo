import { Inject, Injectable } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { createConflictError } from 'src/clean-arch/kernel/types/errors';
import { PlaylistTrack } from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';
import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
} from '../../ports/repositories/IPlaylistRepository';
import {
  AddTrackToPlaylistData,
  IPlaylistTrackRepository,
  PLAYLIST_TRACK_REPOSITORY,
} from '../../ports/repositories/IPlaylistTrackRepository';

@Injectable()
export class AddTrackToPlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_TRACK_REPOSITORY)
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
    @Inject(MUSIC_TRACK_REPOSITORY)
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

    if (!existingPlaylistTrack) {
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
