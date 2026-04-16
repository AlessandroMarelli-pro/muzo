import { Inject } from '@nestjs/common';
import {
  HQ_AUDIO_ACQUIRE_PRODUCER,
  IHqAudioAcquireProducer,
} from 'src/application/ports/infrastructure/IHqAudioAcquireProducer';
import { MusicTrackId } from 'src/kernel/ids';
import { createNotFoundError, models } from 'src/kernel/types';
import { getCurrentUser } from 'src/kernel/types/context';
import { MusicTrack } from 'src/kernel/types/model-types';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';

export class ToggleFavoriteUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,

    private readonly playlistRepository: IPlaylistRepository,

    private readonly playlistTrackRepository: IPlaylistTrackRepository,
    @Inject(HQ_AUDIO_ACQUIRE_PRODUCER)
    private readonly hqAudioAcquireProducer: IHqAudioAcquireProducer,
  ) {}

  async execute(id: MusicTrackId): Promise<MusicTrack> {
    const track = await this.musicTrackRepository.getOneById(id);
    const isFavorite = !track.stats?.isFavorite;
    if (!track) {
      throw createNotFoundError(`Music track with ID ${id} not found`);
    }
    const playlist = await this.playlistRepository.getFavorite();
    if (!playlist) {
      throw createNotFoundError(`Favorite playlist not found`);
    }

    if (isFavorite) {
      const lastPosition = await this.playlistTrackRepository.getLastPosition(playlist.id);
      const position = (lastPosition ?? 0) + 1;
      await this.playlistTrackRepository.save(
        models.playlistTrack.instantiateNew({
          playlistId: playlist.id,
          trackId: id,
          position,
          addedAt: new Date(),
        }),
      );
    } else {
      await this.playlistTrackRepository.removeTrackFromPlaylist(playlist.id, id);
    }
    const updated = await this.musicTrackRepository.updateOneById(id, {
      stats: { isFavorite, isBanger: isFavorite, isLiked: isFavorite },
    });
    await this.hqAudioAcquireProducer.scheduleHqAudioAcquire(id, getCurrentUser());
    return updated;
  }
}
