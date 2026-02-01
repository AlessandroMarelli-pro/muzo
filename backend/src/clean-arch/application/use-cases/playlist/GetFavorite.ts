import { Inject, Injectable } from '@nestjs/common';
import { PlaylistTrackWithTrackDetailAndSorting } from '../../dtos/PlaylistWithTrackDetailsAndSorting';
import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
} from '../../ports/repositories/IPlaylistRepository';

@Injectable()
export class GetFavoriteUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
  ) {}

  async execute(): Promise<PlaylistTrackWithTrackDetailAndSorting> {
    return this.playlistRepository.getFavorite();
  }
}
