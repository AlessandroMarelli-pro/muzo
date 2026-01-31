// GetPlaylist.ts
import { Inject, Injectable } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';

import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
  PlaylistWithSortingAndTracks,
} from '../../ports/repositories/IPlaylistRepository';

@Injectable()
export class GetPlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
  ) {}

  async execute(id: PlaylistId): Promise<PlaylistWithSortingAndTracks> {
    const playlist = await this.playlistRepository.getOneByIdWithTracks(id);
    return playlist;
  }
}
