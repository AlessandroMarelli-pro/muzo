import { MusicTrackId } from 'src/kernel/ids';
import { MusicTrack } from 'src/kernel/types/model-types';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class ToggleBangerUseCase {
  constructor(private readonly musicTrackRepository: IMusicTrackRepository) {}

  async execute(id: MusicTrackId): Promise<MusicTrack> {
    return this.musicTrackRepository.updateOneById(id, {
      stats: { isBanger: true, isLiked: true },
    });
  }
}
