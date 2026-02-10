import { Playlist } from 'src/kernel/types';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';

export class GetPlaylistsUseCase {
  constructor(private readonly playlistRepository: IPlaylistRepository) {}

  async execute(): Promise<Playlist[]> {
    return this.playlistRepository.getMany();
  }
}
