import { PlaylistId } from 'src/kernel/ids';
import { PlaylistTrack } from 'src/kernel/types/model-types';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';

export class GetPlaylistTracksUseCase {
  constructor(private readonly playlistTrackRepository: IPlaylistTrackRepository) {}

  async execute(playlistId: PlaylistId): Promise<PlaylistTrack[]> {
    return this.playlistTrackRepository.getTracksByPlaylistId(playlistId);
  }
}
