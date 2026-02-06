import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { Playlist } from 'src/clean-arch/kernel/types/model-types';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';
import { UpdatePlaylistInput } from './UpdatePlaylist.input';

export class UpdatePlaylistUseCase {
  constructor(private readonly playlistRepository: IPlaylistRepository) {}

  async execute(
    id: PlaylistId,
    updatePlaylistInput: UpdatePlaylistInput,
  ): Promise<Playlist> {
    return this.playlistRepository.updateOneById(id, {
      name: updatePlaylistInput.name,
      description: updatePlaylistInput.description ?? null,
      isPublic: updatePlaylistInput.isPublic ?? false,
    });
  }
}
