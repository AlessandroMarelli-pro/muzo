import { Inject, Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class RegisterPlayedTrackUseCase {
  constructor(
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,
  ) {}

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
