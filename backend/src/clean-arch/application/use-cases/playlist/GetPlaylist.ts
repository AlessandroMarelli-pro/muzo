import { Inject, Injectable } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { Playlist } from 'src/clean-arch/kernel/types/model-types';
import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
} from '../../ports/repositories/IPlaylistRepository';

@Injectable()
export class GetPlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
  ) {}

  async execute(id: PlaylistId): Promise<Playlist> {
    return this.playlistRepository.getOneById(id);
  }
}
