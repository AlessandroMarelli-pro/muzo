import { Inject, Injectable } from '@nestjs/common';
import { UserId } from 'src/clean-arch/kernel/ids';
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

  async execute(createdById: UserId): Promise<Playlist[]> {
    return this.playlistRepository.getManyByUserId(createdById);
  }
}
