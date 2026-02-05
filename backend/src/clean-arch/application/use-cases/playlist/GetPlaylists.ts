import { Injectable } from '@nestjs/common';
import { Playlist } from 'src/clean-arch/kernel/types';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';

@Injectable()
export class GetPlaylistsUseCase {
  constructor(private readonly playlistRepository: IPlaylistRepository) {}

  async execute(): Promise<Playlist[]> {
    return this.playlistRepository.getMany();
  }
}
