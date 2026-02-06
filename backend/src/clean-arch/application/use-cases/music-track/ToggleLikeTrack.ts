import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class ToggleLikeUseCase {
  constructor(private readonly musicTrackRepository: IMusicTrackRepository) {}

  async execute(id: MusicTrackId): Promise<MusicTrack> {
    return this.musicTrackRepository.updateOneById(id, {
      stats: { isLiked: true },
    });
  }
}
