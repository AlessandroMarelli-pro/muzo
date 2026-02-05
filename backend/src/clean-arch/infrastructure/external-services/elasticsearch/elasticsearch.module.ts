import { Global, Module } from '@nestjs/common';
import { RECOMMENDATION_SEARCH_PORT } from 'src/clean-arch/application/ports/queries/IRecommendationSearchPort';
import { TRACK_INDEXER_PORT } from 'src/clean-arch/application/ports/queries/ITrackIndexerPort';
import { ElasticsearchTrackIndexerAdapter } from './elasticsearch-track-indexer.adapter';
import { ElasticsearchClient } from './elasticsearch.client';
import { RecommendationSearchAdapter } from './recommendation-search.adapter';

@Global()
@Module({
  providers: [
    ElasticsearchClient,
    {
      provide: TRACK_INDEXER_PORT,
      useClass: ElasticsearchTrackIndexerAdapter,
    },
    {
      provide: RECOMMENDATION_SEARCH_PORT,
      useClass: RecommendationSearchAdapter,
    },
  ],
  exports: [
    ElasticsearchClient,
    TRACK_INDEXER_PORT,
    RECOMMENDATION_SEARCH_PORT,
  ],
})
export class ElasticsearchModule {}
