import { Inject, Injectable } from '@nestjs/common';
import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class GetTracksUseCase {
  constructor(
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,
  ) {}
  execute(): Promise<MusicTrack[]> {
    return this.musicTrackRepository.getAll();
  }
}
