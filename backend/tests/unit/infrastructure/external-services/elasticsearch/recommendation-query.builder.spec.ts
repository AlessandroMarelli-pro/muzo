import { describe, expect, it } from 'vitest';

import type { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import type { RecommendationCriteria } from 'src/kernel/types/model-types';
import { buildElasticsearchRecommendationQuery } from 'src/infrastructure/external-services/elasticsearch/builders/recommendation-query.builder';

const EMBEDDING_DIM = 1280;
const vec = (fill: number): number[] => new Array(EMBEDDING_DIM).fill(fill);

const criteria: RecommendationCriteria = {
  weights: {
    audioSimilarity: 1,
    genreSimilarity: 1,
    metadataSimilarity: 0,
    userBehavior: 0,
    audioFeatures: 1,
  },
  limit: 50,
  excludeTrackIds: [],
};

const baseFeatures = (): AudioFeatures => ({
  trackId: 'MusicTrack:seed' as AudioFeatures['trackId'],
});

describe('buildElasticsearchRecommendationQuery — embedding kNN', () => {
  it('emits one knn clause per valid seed embedding', () => {
    const body = buildElasticsearchRecommendationQuery(
      { ...baseFeatures(), embeddings: [vec(0.1), vec(0.2), vec(0.3)] },
      criteria,
    ) as { knn?: Array<Record<string, unknown>> };

    expect(body.knn).toHaveLength(3);
    for (const clause of body.knn!) {
      expect(clause.field).toBe('audio_features.discogs_embedding');
      // wAudio (1) * default multiplier (35) / seedCount (3)
      expect(clause.boost).toBeCloseTo(35 / 3);
    }
  });

  it('falls back to the centroid embedding as a single knn clause', () => {
    const body = buildElasticsearchRecommendationQuery(
      { ...baseFeatures(), embedding: vec(0.5) },
      criteria,
    ) as { knn?: unknown[] };

    expect(body.knn).toHaveLength(1);
  });

  it('omits knn entirely when no valid vectors are present', () => {
    const body = buildElasticsearchRecommendationQuery(baseFeatures(), criteria) as {
      knn?: unknown;
    };

    expect(body.knn).toBeUndefined();
  });

  it('ignores malformed vectors (wrong dim / non-finite)', () => {
    const body = buildElasticsearchRecommendationQuery(
      {
        ...baseFeatures(),
        embeddings: [vec(0.1), new Array(10).fill(1), [...vec(0.2).slice(1), NaN]],
      },
      criteria,
    ) as { knn?: unknown[] };

    expect(body.knn).toHaveLength(1);
  });

  it('omits knn when audioSimilarity weight is 0', () => {
    const body = buildElasticsearchRecommendationQuery(
      { ...baseFeatures(), embeddings: [vec(0.1)] },
      { ...criteria, weights: { ...criteria.weights, audioSimilarity: 0 } },
    ) as { knn?: unknown };

    expect(body.knn).toBeUndefined();
  });
});
