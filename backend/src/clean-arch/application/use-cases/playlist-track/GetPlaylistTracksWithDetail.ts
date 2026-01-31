import { Inject, Injectable } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { PlaylistTrackWithTrackDetail } from '../../dtos/PlaylistTrackWithDetail';
import {
  IPlaylistTrackRepository,
  PLAYLIST_TRACK_REPOSITORY,
} from '../../ports/repositories/IPlaylistTrackRepository';

@Injectable()
export class GetPlaylistTracksWithDetailUseCase {
  constructor(
    @Inject(PLAYLIST_TRACK_REPOSITORY)
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
  ) {}

  async execute(
    playlistId: PlaylistId,
  ): Promise<PlaylistTrackWithTrackDetail[]> {
    return this.playlistTrackRepository.getTracksByPlaylistIdWithTrack(
      playlistId,
    );
  }
}
