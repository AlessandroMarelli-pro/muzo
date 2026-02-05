import { Injectable } from '@nestjs/common';
import { Maybe } from 'src/clean-arch/kernel/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { PlaylistSorting } from 'src/clean-arch/kernel/types/model-types';
import { IPlaylistSortingRepository } from '../../ports/repositories/IPlaylistSortingRepository';

@Injectable()
export class GetPlaylistSortingByPlaylistIdUseCase {
  constructor(
    private readonly playlistSortingRepository: IPlaylistSortingRepository,
  ) {}
  async execute(playlistId: PlaylistId): Promise<Maybe<PlaylistSorting>> {
    return this.playlistSortingRepository.getByPlaylistId(playlistId);
  }
}
