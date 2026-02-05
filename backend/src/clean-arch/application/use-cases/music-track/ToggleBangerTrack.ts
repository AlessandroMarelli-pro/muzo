import { Inject, Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class ToggleBangerUseCase {
  constructor(
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,
  ) {}

  async execute(id: MusicTrackId): Promise<MusicTrack> {
    return this.musicTrackRepository.updateOneById(id, {
      stats: { isBanger: true, isLiked: true },
    });
  }
}
