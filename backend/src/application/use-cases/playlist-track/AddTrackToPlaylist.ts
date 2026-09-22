import { Inject } from '@nestjs/common';
import {
  BANDCAMP_RESOLVE_PRODUCER,
  IBandcampResolveProducer,
} from 'src/application/ports/infrastructure/IBandcampResolveProducer';
import {
  DISCOGS_RESOLVE_PRODUCER,
  IDiscogsResolveProducer,
} from 'src/application/ports/infrastructure/IDiscogsResolveProducer';
import { PlaylistId } from 'src/kernel/ids';
import { getCurrentUser } from 'src/kernel/types/context';
import { createConflictError } from 'src/kernel/types/errors';
import { PlaylistTrack } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
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

    @Inject(BANDCAMP_RESOLVE_PRODUCER)
    private readonly bandcampResolveProducer: IBandcampResolveProducer,

    @Inject(DISCOGS_RESOLVE_PRODUCER)
    private readonly discogsResolveProducer: IDiscogsResolveProducer,
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
    const existingPlaylistTrack = await this.playlistTrackRepository.verifyPresence(
      playlistId,
      addTrackDto.trackId,
    );

    if (existingPlaylistTrack) {
      throw createConflictError('Track is already in this playlist');
    }
    // Get the next position
    const lastPosition = await this.playlistTrackRepository.getLastPosition(playlistId);

    const nextPosition = (lastPosition ?? 0) + 1;
    const playlistTrack = models.playlistTrack.instantiateNew({
      playlistId,
      trackId: addTrackDto.trackId,
      position: addTrackDto.position ?? nextPosition,
      addedAt: new Date(),
    });
    const saved = await this.playlistTrackRepository.save(playlistTrack);
    const contextUser = getCurrentUser();
    await this.bandcampResolveProducer.scheduleBandcampResolve(addTrackDto.trackId, contextUser);
    await this.discogsResolveProducer.scheduleDiscogsResolve(addTrackDto.trackId, contextUser);
    return saved;
  }
}
