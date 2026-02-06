import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class GetTracksUseCase {
  constructor(private readonly musicTrackRepository: IMusicTrackRepository) {}
  execute(): Promise<MusicTrack[]> {
    return this.musicTrackRepository.getAll();
  }
}
