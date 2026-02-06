import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';

export class DeletePlaylistUseCase {
  constructor(private readonly playlistRepository: IPlaylistRepository) {}

  async execute(id: PlaylistId): Promise<boolean> {
    return this.playlistRepository.deleteOneById(id);
  }
}
