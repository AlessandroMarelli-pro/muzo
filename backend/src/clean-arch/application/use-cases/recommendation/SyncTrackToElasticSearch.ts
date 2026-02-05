import { Inject, Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import {
  IRecommendationDataPort,
  RECOMMENDATION_DATA_PORT,
} from '../../ports/queries/IRecommendationDataPort';
import {
  ITrackIndexerPort,
  TRACK_INDEXER_PORT,
} from '../../ports/queries/ITrackIndexerPort';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class SyncTrackToElasticSearchUseCase {
  constructor(
    @Inject(TRACK_INDEXER_PORT)
    private readonly trackIndexerPort: ITrackIndexerPort,
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(RECOMMENDATION_DATA_PORT)
    private readonly recommendationDataPort: IRecommendationDataPort,
  ) {}

  async execute(trackId: MusicTrackId): Promise<void> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    return this.trackIndexerPort.indexTrack(track);
  }
}
