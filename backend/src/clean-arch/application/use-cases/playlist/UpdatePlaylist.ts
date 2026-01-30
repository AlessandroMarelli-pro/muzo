import { Inject, Injectable } from '@nestjs/common';

import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { Playlist } from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
} from '../../ports/repositories/IPlaylistRepository';
import { UpdatePlaylistInput } from './UpdatePlaylist.input';

@Injectable()
export class UpdatePlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
  ) {}

  async execute(
    id: PlaylistId,
    updatePlaylistInput: UpdatePlaylistInput,
  ): Promise<Playlist> {
    const updatedPlaylist = models.playlist.update(updatePlaylistInput);
    return this.playlistRepository.updateOneById(id, updatedPlaylist);
  }
}
