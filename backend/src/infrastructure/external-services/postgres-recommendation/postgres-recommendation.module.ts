import { Global, Module } from '@nestjs/common';
import { RECOMMENDATION_SEARCH_PORT } from 'src/application/ports/queries/IRecommendationSearchPort';
import { TRACK_INDEXER_PORT } from 'src/application/ports/queries/ITrackIndexerPort';
import { PostgresRecommendationSearchAdapter } from './postgres-recommendation-search.adapter';
import { PostgresTrackIndexerAdapter } from './postgres-track-indexer.adapter';

@Global()
@Module({
  providers: [
    {
      provide: TRACK_INDEXER_PORT,
      useClass: PostgresTrackIndexerAdapter,
    },
    {
      provide: RECOMMENDATION_SEARCH_PORT,
      useClass: PostgresRecommendationSearchAdapter,
    },
  ],
  exports: [TRACK_INDEXER_PORT, RECOMMENDATION_SEARCH_PORT],
})
export class PostgresRecommendationModule {}
