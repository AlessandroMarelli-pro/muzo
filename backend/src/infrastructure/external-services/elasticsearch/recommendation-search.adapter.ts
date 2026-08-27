import { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { IRecommendationSearchPort } from 'src/application/ports/queries/IRecommendationSearchPort';
import { RecommendationCriteria } from 'src/kernel/types';

import { Client } from '@elastic/elasticsearch';
import { SearchRequest } from '@elastic/elasticsearch/lib/api/types';
import { Injectable } from '@nestjs/common';
import { RecommendationMatch } from 'src/application/ports/dtos/RecommendationMatch';
import { buildElasticsearchRecommendationQuery } from './builders/recommendation-query.builder';
import { ElasticsearchClient } from './elasticsearch.client';
import { extractReasonsFromElasticsearch } from './helpers/extract-reason';
import { toMusicTrack } from './mappers/track-index-document.mapper';

@Injectable()
export class RecommendationSearchAdapter implements IRecommendationSearchPort {
  private elasticsearchClient: Client;

  constructor(private readonly client: ElasticsearchClient) {
    this.elasticsearchClient = this.client.getClient();
  }

  async searchByFeatures(
    features: AudioFeatures[],
    criteria: RecommendationCriteria,
  ): Promise<RecommendationMatch[]> {
    const query = buildElasticsearchRecommendationQuery(
      features[0],
      criteria,
    ) as unknown as SearchRequest['body'];
    console.log(query);
    const response = await this.elasticsearchClient.search({
      index: 'music_tracks',
      body: query,
    });
    const hits = response.hits.hits;
    hits.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

    const limit = criteria.limit ?? 50;
    const topHits = hits.slice(0, limit);

    return topHits.map((hit: any) => {
      return {
        track: toMusicTrack(hit._source),
        similarity: hit._score, // Use raw Elasticsearch score directly
        reasons: extractReasonsFromElasticsearch(hit, features[0]),
      };
    });
  }
}
