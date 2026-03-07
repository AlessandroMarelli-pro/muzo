// GetPlaylist.ts
import { PlaylistId } from 'src/kernel/ids';

import {
  IPlaylistRepository,
  PlaylistWithSortingAndTracks,
} from '../../ports/repositories/IPlaylistRepository';
import { IPlaylistSortingRepository } from '../../ports/repositories/IPlaylistSortingRepository';

export class GetPlaylistUseCase {
  constructor(
    private readonly playlistRepository: IPlaylistRepository,

    private readonly playlistSortingRepository: IPlaylistSortingRepository,
  ) {}

  async execute(id: PlaylistId): Promise<PlaylistWithSortingAndTracks> {
    const sorting = await this.playlistSortingRepository.getByPlaylistId(id);
    const playlist = await this.playlistRepository.getOneByIdWithTracks(id, sorting);
    return playlist;
  }
}
