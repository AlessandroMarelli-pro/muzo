import { PlaylistTrackWithTrackDetailAndSorting } from '../../ports/dtos/PlaylistWithTrackDetailsAndSorting';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';

export class GetFavoriteUseCase {
  constructor(private readonly playlistRepository: IPlaylistRepository) {}

  async execute(): Promise<PlaylistTrackWithTrackDetailAndSorting> {
    return this.playlistRepository.getFavorite();
  }
}
