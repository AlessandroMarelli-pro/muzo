import { Maybe } from 'src/kernel/common';
import { PlaylistId } from 'src/kernel/ids';
import { PlaylistSorting } from 'src/kernel/types/model-types';
import { IPlaylistSortingRepository } from '../../ports/repositories/IPlaylistSortingRepository';

export class GetPlaylistSortingByPlaylistIdUseCase {
  constructor(private readonly playlistSortingRepository: IPlaylistSortingRepository) {}
  async execute(playlistId: PlaylistId): Promise<Maybe<PlaylistSorting>> {
    return this.playlistSortingRepository.getByPlaylistId(playlistId);
  }
}
