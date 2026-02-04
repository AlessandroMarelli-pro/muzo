import { Inject, Injectable } from '@nestjs/common';
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
export class SyncAllTracksToElasticsearchUseCase {
  constructor(
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(TRACK_INDEXER_PORT)
    private readonly trackIndexerPort: ITrackIndexerPort,
    @Inject(RECOMMENDATION_DATA_PORT)
    private readonly recommendationDataPort: IRecommendationDataPort,
  ) {}

  async execute(): Promise<void> {
    await this.trackIndexerPort.recreateIndex();
    const tracks = await this.musicTrackRepository.getAll();
    await this.trackIndexerPort.deleteTracks(tracks.map((track) => track.id));
    return this.trackIndexerPort.indexTracks(
      tracks.map(this.recommendationDataPort.getTrackIndexDocument),
    );
  }
}
