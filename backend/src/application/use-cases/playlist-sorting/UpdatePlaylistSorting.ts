import { PlaylistId } from 'src/kernel/ids';
import { models, PlaylistSorting } from 'src/kernel/types';
import {
  IPlaylistSortingRepository,
  PlaylistSortingUpsertData,
} from '../../ports/repositories/IPlaylistSortingRepository';

export class UpdatePlaylistSortingUseCase {
  constructor(private readonly playlistSortingRepository: IPlaylistSortingRepository) {}

  async execute(playlistId: PlaylistId, data: PlaylistSortingUpsertData): Promise<PlaylistSorting> {
    if (await this.playlistSortingRepository.verifyExistence(playlistId)) {
      return this.playlistSortingRepository.update(playlistId, data);
    }
    return this.playlistSortingRepository.save(
      models.playlistSorting.instantiateNew({
        playlistId,
        sortingKey: data.sortingKey,
        sortingDirection: data.sortingDirection,
      }),
    );
  }
}
