import { Injectable } from '@nestjs/common';
import { MusicTrack } from 'src/clean-arch/kernel/types/model-types';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class GetTracksUseCase {
  constructor(private readonly musicTrackRepository: IMusicTrackRepository) {}
  execute(): Promise<MusicTrack[]> {
    return this.musicTrackRepository.getAll();
  }
}
