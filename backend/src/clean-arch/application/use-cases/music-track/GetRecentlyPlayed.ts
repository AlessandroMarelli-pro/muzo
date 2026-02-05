import { Injectable } from '@nestjs/common';
import { MusicTrack } from 'src/clean-arch/kernel/types';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class GetRecentlyPlayedUseCase {
  constructor(private readonly musicTrackRepository: IMusicTrackRepository) {}

  async execute(): Promise<MusicTrack[]> {
    return this.musicTrackRepository.getManyByCriteria(null, 'exact', {
      limit: 20,
      offset: 0,
      orderDirection: 'desc',
      orderBy: 'lastPlayedAt',
    });
  }
}
