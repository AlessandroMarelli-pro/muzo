import { Inject, Injectable } from '@nestjs/common';
import { Playlist } from 'src/clean-arch/kernel/types';
import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
} from '../../ports/repositories/IPlaylistRepository';

@Injectable()
export class GetPlaylistsUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
  ) {}

  async execute(): Promise<Playlist[]> {
    return this.playlistRepository.getMany();
  }
}
