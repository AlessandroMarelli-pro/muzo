import { Inject, Injectable } from '@nestjs/common';

import { PlaylistId } from 'src/clean-arch/kernel/ids';
import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
} from '../../ports/repositories/IPlaylistRepository';

@Injectable()
export class DeletePlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
  ) {}

  async execute(id: PlaylistId): Promise<boolean> {
    return this.playlistRepository.deleteOneById(id);
  }
}
