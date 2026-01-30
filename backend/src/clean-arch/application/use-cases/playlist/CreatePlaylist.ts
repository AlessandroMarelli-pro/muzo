import { Inject, Injectable } from '@nestjs/common';
import { Playlist } from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
} from '../../ports/repositories/IPlaylistRepository';
import { CreatePlaylistInput } from './CreatePlaylist.input';

@Injectable()
export class CreatePlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
  ) {}

  async execute(createPlaylistInput: CreatePlaylistInput): Promise<Playlist> {
    const playlist = models.playlist.instantiateNew({
      ...createPlaylistInput,
      isPublic: createPlaylistInput.isPublic ?? false,
      description: createPlaylistInput.description ?? null,
    });
    return this.playlistRepository.save(playlist);
  }
}
