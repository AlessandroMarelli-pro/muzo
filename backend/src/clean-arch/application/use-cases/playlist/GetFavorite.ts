import { Injectable } from '@nestjs/common';
import { PlaylistTrackWithTrackDetailAndSorting } from '../../ports/dtos/PlaylistWithTrackDetailsAndSorting';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';

@Injectable()
export class GetFavoriteUseCase {
  constructor(private readonly playlistRepository: IPlaylistRepository) {}

  async execute(): Promise<PlaylistTrackWithTrackDetailAndSorting> {
    return this.playlistRepository.getFavorite();
  }
}
