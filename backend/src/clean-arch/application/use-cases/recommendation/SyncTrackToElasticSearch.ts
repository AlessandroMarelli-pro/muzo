import { Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { IRecommendationDataPort } from '../../ports/queries/IRecommendationDataPort';
import { ITrackIndexerPort } from '../../ports/queries/ITrackIndexerPort';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class SyncTrackToElasticSearchUseCase {
  constructor(
    private readonly trackIndexerPort: ITrackIndexerPort,

    private readonly musicTrackRepository: IMusicTrackRepository,

    private readonly recommendationDataPort: IRecommendationDataPort,
  ) {}

  async execute(trackId: MusicTrackId): Promise<void> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    return this.trackIndexerPort.indexTrack(track);
  }
}
