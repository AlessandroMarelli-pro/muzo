// GetPlaylist.ts
import { Inject, Injectable } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';

import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
  PlaylistWithSortingAndTracks,
} from '../../ports/repositories/IPlaylistRepository';
import {
  IPlaylistSortingRepository,
  PLAYLIST_SORTING_REPOSITORY,
} from '../../ports/repositories/IPlaylistSortingRepository';

@Injectable()
export class GetPlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
    @Inject(PLAYLIST_SORTING_REPOSITORY)
    private readonly playlistSortingRepository: IPlaylistSortingRepository,
  ) {}

  async execute(id: PlaylistId): Promise<PlaylistWithSortingAndTracks> {
    const sorting = await this.playlistSortingRepository.getByPlaylistId(id);
    const playlist = await this.playlistRepository.getOneByIdWithTracks(
      id,
      sorting,
    );
    return playlist;
  }
}
