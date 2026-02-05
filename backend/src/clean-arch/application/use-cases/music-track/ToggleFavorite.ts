import { Inject, Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { createNotFoundError, models } from 'src/clean-arch/kernel/types';
import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';
import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
} from '../../ports/repositories/IPlaylistRepository';
import {
  IPlaylistTrackRepository,
  PLAYLIST_TRACK_REPOSITORY,
} from '../../ports/repositories/IPlaylistTrackRepository';

@Injectable()
export class ToggleFavoriteUseCase {
  constructor(
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
    @Inject(PLAYLIST_TRACK_REPOSITORY)
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
  ) {}

  async execute(id: MusicTrackId): Promise<MusicTrack> {
    const track = await this.musicTrackRepository.getOneById(id);
    const isFavorite = !track.stats.isFavorite;
    if (!track) {
      throw createNotFoundError(`Music track with ID ${id} not found`);
    }
    const playlist = await this.playlistRepository.getFavorite();
    if (!playlist) {
      throw createNotFoundError(`Favorite playlist not found`);
    }

    if (isFavorite) {
      await this.playlistTrackRepository.save(
        models.playlistTrack.instantiateNew({
          playlistId: playlist.id,
          trackId: id,
          position: 0,
          addedAt: new Date(),
        }),
      );
    } else {
      await this.playlistTrackRepository.removeTrackFromPlaylist(
        playlist.id,
        id,
      );
    }
    return this.musicTrackRepository.updateOneById(id, {
      stats: { isFavorite, isBanger: isFavorite, isLiked: isFavorite },
    });
  }
}
