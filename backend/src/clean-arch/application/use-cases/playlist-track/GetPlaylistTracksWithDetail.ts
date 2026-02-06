import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { PlaylistTrackWithTrackDetail } from '../../ports/dtos/PlaylistTrackWithDetail';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';

export class GetPlaylistTracksWithDetailUseCase {
  constructor(
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
