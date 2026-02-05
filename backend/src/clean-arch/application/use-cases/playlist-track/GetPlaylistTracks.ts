import { Injectable } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { PlaylistTrack } from 'src/clean-arch/kernel/types/model-types';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';

@Injectable()
export class GetPlaylistTracksUseCase {
  constructor(
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
  ) {}

  async execute(playlistId: PlaylistId): Promise<PlaylistTrack[]> {
    return this.playlistTrackRepository.getTracksByPlaylistId(playlistId);
  }
}
