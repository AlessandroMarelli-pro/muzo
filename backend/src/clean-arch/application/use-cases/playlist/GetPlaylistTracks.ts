import { Inject, Injectable } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { PlaylistTrack } from 'src/clean-arch/kernel/types/model-types';
import {
  IPlaylistTrackRepository,
  PLAYLIST_TRACK_REPOSITORY,
} from '../../ports/repositories/IPlaylistTrackRepository';

@Injectable()
export class GetPlaylistTracksUseCase {
  constructor(
    @Inject(PLAYLIST_TRACK_REPOSITORY)
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
  ) {}

  async execute(playlistId: PlaylistId): Promise<PlaylistTrack[]> {
    return this.playlistTrackRepository.getTracksByPlaylistId(playlistId);
  }
}
