import { Inject, Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class GetRandomTrackIdUseCase {
  constructor(
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,
  ) {}

  async execute(): Promise<MusicTrackId> {
    return this.musicTrackRepository.getRandomTrackId();
  }
}
