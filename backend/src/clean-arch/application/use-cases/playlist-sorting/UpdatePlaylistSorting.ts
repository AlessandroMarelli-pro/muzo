import { Injectable } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { models, PlaylistSorting } from 'src/clean-arch/kernel/types';
import {
  IPlaylistSortingRepository,
  PlaylistSortingUpsertData,
} from '../../ports/repositories/IPlaylistSortingRepository';

@Injectable()
export class UpdatePlaylistSortingUseCase {
  constructor(
    private readonly playlistSortingRepository: IPlaylistSortingRepository,
  ) {}

  async execute(
    playlistId: PlaylistId,
    data: PlaylistSortingUpsertData,
  ): Promise<PlaylistSorting> {
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
