import { Injectable } from '@nestjs/common';

import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';

@Injectable()
export class DeletePlaylistUseCase {
  constructor(private readonly playlistRepository: IPlaylistRepository) {}

  async execute(id: PlaylistId): Promise<boolean> {
    return this.playlistRepository.deleteOneById(id);
  }
}
