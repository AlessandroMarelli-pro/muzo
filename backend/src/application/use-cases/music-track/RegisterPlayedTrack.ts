import { MusicTrackId } from 'src/kernel/ids';
import { MusicTrack } from 'src/kernel/types/model-types';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class RegisterPlayedTrackUseCase {
  constructor(private readonly musicTrackRepository: IMusicTrackRepository) {}

  async execute(id: MusicTrackId): Promise<MusicTrack> {
    const lastPlayedTrack =
      await this.musicTrackRepository.getLastPlayedTrack();

    if (
      lastPlayedTrack.id === id &&
      lastPlayedTrack.stats.lastPlayedAt >
        new Date(Date.now() - 1000 * 60 * 60 * 5)
    ) {
      return;
    }
    return this.musicTrackRepository.incrementListeningCount(id);
  }
}
