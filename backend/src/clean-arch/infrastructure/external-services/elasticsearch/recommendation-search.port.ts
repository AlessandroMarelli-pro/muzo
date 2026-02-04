import { AudioFeatures } from 'src/clean-arch/application/ports/dtos/AudioFeatures';
import { IRecommendationSearchPort } from 'src/clean-arch/application/ports/queries/IRecommendationSearchPort';
import { RecommendationCriteria } from 'src/clean-arch/kernel/types';

import { Inject } from '@nestjs/common';
import { TrackIndexDocumentSimilarity } from 'src/clean-arch/application/ports/dtos/TrackIndexDocumentSimilarity';
import {
  ITrackIndexerPort,
  TRACK_INDEXER_PORT,
} from 'src/clean-arch/application/ports/queries/ITrackIndexerPort';
import { buildElasticsearchRecommendationQuery } from './builders/recommendation-query.builder';

export class RecommendationSearchPort implements IRecommendationSearchPort {
  constructor(
    @Inject(TRACK_INDEXER_PORT)
    private readonly trackIndexerPort: ITrackIndexerPort,
  ) {}
  async searchByFeatures(
    features: AudioFeatures[],
    criteria: RecommendationCriteria,
  ): Promise<TrackIndexDocumentSimilarity[]> {
    const query = buildElasticsearchRecommendationQuery(features[0], criteria);
    return this.trackIndexerPort.searchTracks(features[0], query);
  }
}
