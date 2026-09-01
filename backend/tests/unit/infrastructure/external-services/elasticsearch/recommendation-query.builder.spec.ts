import { afterEach, describe, expect, it } from 'vitest';

import type { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import type { RecommendationCriteria, RecommendationWeights } from 'src/kernel/types/model-types';
import { buildElasticsearchRecommendationQuery } from 'src/infrastructure/external-services/elasticsearch/builders/recommendation-query.builder';

const EMBEDDING_DIM = 1280;
const vec = (fill: number): number[] => new Array(EMBEDDING_DIM).fill(fill);

const weights: RecommendationWeights = {
  audioSimilarity: 0,
  genreSimilarity: 0.1,
  metadataSimilarity: 0,
  userBehavior: 0,
  audioFeatures: 0.08,
  moodSimilarity: 0.2,
  arousalSimilarity: 0.12,
  danceabilitySimilarity: 0.12,
  instrumentalnessSimilarity: 0.05,
  voiceSimilarity: 0.05,
  instrumentsSimilarity: 0.12,
};

const criteria: RecommendationCriteria = {
  weights,
  limit: 50,
  excludeTrackIds: [],
};

const baseFeatures = (): AudioFeatures => ({
  trackId: 'MusicTrack:seed' as AudioFeatures['trackId'],
});

type Bool = { filter?: unknown[]; must_not?: unknown[] };
type FnScoreFunction = {
  script_score?: { script: { source: string; params: Record<string, number[]> } };
  gauss?: Record<string, unknown>;
  filter?: { term: Record<string, string> };
  weight: number;
};
type QueryBody = {
  size: number;
  query: {
    function_score: {
      query: { bool: Bool };
      functions: FnScoreFunction[];
      score_mode: string;
      boost_mode: string;
    };
  };
};

const build = (features: AudioFeatures, c: RecommendationCriteria = criteria) =>
  buildElasticsearchRecommendationQuery(features, c) as unknown as QueryBody;

const scriptFunctions = (body: QueryBody) =>
  body.query.function_score.functions.filter((f) => f.script_score);

/** Number of distinct per-seed params (s0, s1, ...) on a script_score function --
 * the seed count actually baked into the query. */
const seedParamCount = (fn: FnScoreFunction) => Object.keys(fn.script_score!.script.params).length;

describe('buildElasticsearchRecommendationQuery — embedding base', () => {
  it('always uses boost_mode replace and score_mode sum', () => {
    const body = build({ ...baseFeatures(), embedding: vec(0.5) });
    expect(body.query.function_score.boost_mode).toBe('replace');
    expect(body.query.function_score.score_mode).toBe('sum');
  });

  it('emits exactly one script_score base function with weight 1.0', () => {
    const body = build({ ...baseFeatures(), embeddings: [vec(0.1), vec(0.2), vec(0.3)] });
    const fns = scriptFunctions(body);
    expect(fns).toHaveLength(1);
    expect(fns[0].weight).toBe(1.0);
    expect(seedParamCount(fns[0])).toBe(3);
  });

  it('falls back to the centroid embedding as a single-seed base', () => {
    const body = build({ ...baseFeatures(), embedding: vec(0.5) });
    const fns = scriptFunctions(body);
    expect(fns).toHaveLength(1);
    expect(seedParamCount(fns[0])).toBe(1);
  });

  it('omits the base function and the exists guard when no valid vectors are present', () => {
    const body = build(baseFeatures());
    expect(scriptFunctions(body)).toHaveLength(0);
    expect(body.query.function_score.query.bool.filter ?? []).toEqual([]);
  });

  it('ignores malformed vectors (wrong dim / non-finite)', () => {
    const body = build({
      ...baseFeatures(),
      embeddings: [vec(0.1), new Array(10).fill(1), [...vec(0.2).slice(1), NaN]],
    });
    const fns = scriptFunctions(body);
    expect(seedParamCount(fns[0])).toBe(1);
  });

  it('requires the exists guard on the embedding field whenever the base runs -- regression test for the shard-failure bug', () => {
    const body = build({ ...baseFeatures(), embedding: vec(0.5) });
    expect(body.query.function_score.query.bool.filter).toContainEqual({
      exists: { field: 'audio_features.discogs_embedding' },
    });
  });

  it('excludeTrackIds appears exactly once, in must_not', () => {
    const body = build(
      { ...baseFeatures(), embedding: vec(0.5) },
      { ...criteria, excludeTrackIds: ['MusicTrack:a', 'MusicTrack:b'] as never },
    );
    expect(body.query.function_score.query.bool.must_not).toEqual([
      { terms: { trackId: ['MusicTrack:a', 'MusicTrack:b'] } },
    ]);
  });

  describe('kill-switch: ELASTICSEARCH_EMBEDDING_VECTOR_SIMILARITY', () => {
    const ORIGINAL = process.env.ELASTICSEARCH_EMBEDDING_VECTOR_SIMILARITY;
    afterEach(() => {
      if (ORIGINAL === undefined) {
        delete process.env.ELASTICSEARCH_EMBEDDING_VECTOR_SIMILARITY;
      } else {
        process.env.ELASTICSEARCH_EMBEDDING_VECTOR_SIMILARITY = ORIGINAL;
      }
    });

    it('drops the base function when set to false', () => {
      process.env.ELASTICSEARCH_EMBEDDING_VECTOR_SIMILARITY = 'false';
      const body = build({ ...baseFeatures(), embedding: vec(0.5) });
      expect(scriptFunctions(body)).toHaveLength(0);
    });
  });

  describe('seedStrategy', () => {
    it('defaults to the mean script (sum-then-divide) when absent', () => {
      const body = build({ ...baseFeatures(), embeddings: [vec(0.1), vec(0.2)] });
      const source = scriptFunctions(body)[0].script_score!.script.source;
      expect(source).toContain('/ 2.0 + 1.0');
      expect(source).not.toContain('Math.max');
    });

    it('selects the max script (nested Math.max) when seedStrategy is "max"', () => {
      const body = build(
        { ...baseFeatures(), embeddings: [vec(0.1), vec(0.2)] },
        { ...criteria, seedStrategy: 'max' },
      );
      expect(scriptFunctions(body)[0].script_score!.script.source).toContain('Math.max');
    });

    it('mean and max scripts are different', () => {
      const meanBody = build(
        { ...baseFeatures(), embeddings: [vec(0.1), vec(0.2)] },
        { ...criteria, seedStrategy: 'mean' },
      );
      const maxBody = build(
        { ...baseFeatures(), embeddings: [vec(0.1), vec(0.2)] },
        { ...criteria, seedStrategy: 'max' },
      );
      expect(scriptFunctions(meanBody)[0].script_score!.script.source).not.toBe(
        scriptFunctions(maxBody)[0].script_score!.script.source,
      );
    });

    /**
     * Regression test for a real Elasticsearch/Painless engine bug, reproduced
     * against the live cluster: `cosineSimilarity(params.seeds[i], ...)` inside
     * a `for` loop over a variable index silently reuses the FIRST call's query
     * vector on every iteration (confirmed via unrolled single-call baselines
     * matching independently-computed cosine values, while any loop-with-array-
     * index form did not, including copying the element to a local var first).
     * The fix is to generate one literal `cosineSimilarity(params.sN, ...)`
     * call site per seed instead of looping over an array -- assert that shape
     * directly so a future "simplification" back to a loop doesn't silently
     * reintroduce the bug.
     */
    it('unrolls one literal cosineSimilarity call per seed instead of looping over an array index', () => {
      const body = build(
        { ...baseFeatures(), embeddings: [vec(0.1), vec(0.2), vec(0.3)] },
        { ...criteria, seedStrategy: 'mean' },
      );
      const fn = scriptFunctions(body)[0];
      const source = fn.script_score!.script.source;

      expect(source).not.toContain('for (');
      expect(source).not.toContain('seeds[');
      expect((source.match(/cosineSimilarity\(/g) ?? []).length).toBe(3);
      expect(source).toContain("params.s0, 'audio_features.discogs_embedding'");
      expect(source).toContain("params.s1, 'audio_features.discogs_embedding'");
      expect(source).toContain("params.s2, 'audio_features.discogs_embedding'");
      expect(Object.keys(fn.script_score!.script.params)).toEqual(['s0', 's1', 's2']);
    });
  });
});

describe('buildElasticsearchRecommendationQuery — bounded boosts', () => {
  it('omits a boost entirely when its weight is 0', () => {
    const body = build(
      { ...baseFeatures(), embedding: vec(0.5), arousal: 0.6 },
      { ...criteria, weights: { ...weights, arousalSimilarity: 0 } },
    );
    const gaussFns = body.query.function_score.functions.filter((f) => f.gauss);
    expect(gaussFns.some((f) => Object.keys(f.gauss!)[0].includes('arousal'))).toBe(false);
  });

  it('omits a scalar boost when the seed value is absent', () => {
    const body = build({ ...baseFeatures(), embedding: vec(0.5) }, criteria);
    const gaussFns = body.query.function_score.functions.filter((f) => f.gauss);
    expect(gaussFns.some((f) => Object.keys(f.gauss!)[0].includes('danceability'))).toBe(false);
  });

  it('bounds genre boosts to the genreSimilarity weight regardless of match count', () => {
    const body = build(
      { ...baseFeatures(), embedding: vec(0.5), genres: ['rock', 'jazz', 'pop'] },
      criteria,
    );
    const genreFns = body.query.function_score.functions.filter(
      (f) => f.filter && Object.keys(f.filter.term)[0] === 'genres',
    );
    const total = genreFns.reduce((sum, f) => sum + f.weight, 0);
    expect(total).toBeCloseTo(weights.genreSimilarity);
  });

  it('collapses voice and instrumentalness into exactly one gauss function', () => {
    const body = build(
      { ...baseFeatures(), embedding: vec(0.5), voice: 0.7, instrumentalness: 0.3 },
      criteria,
    );
    const voiceFns = body.query.function_score.functions.filter(
      (f) => f.gauss && Object.keys(f.gauss)[0] === 'musical_audio_features.voice',
    );
    expect(voiceFns).toHaveLength(1);
    expect(voiceFns[0].weight).toBeCloseTo(
      weights.voiceSimilarity + weights.instrumentalnessSimilarity,
    );
  });

  it('bounds instrument boosts to the instrumentsSimilarity weight via seed shares', () => {
    const body = build(
      {
        ...baseFeatures(),
        embedding: vec(0.5),
        instruments: [
          { instrument: 'saxophone', weight: 0.7 },
          { instrument: 'bass', weight: 0.3 },
        ],
      },
      criteria,
    );
    const instrumentFns = body.query.function_score.functions.filter(
      (f) => f.filter && Object.keys(f.filter.term)[0] === 'instruments',
    );
    expect(instrumentFns).toHaveLength(2);
    const total = instrumentFns.reduce((sum, f) => sum + f.weight, 0);
    expect(total).toBeCloseTo(weights.instrumentsSimilarity);
  });

  it('the default weight budget (excluding the 1.0 base) stays well under 1.0 so the embedding always dominates', () => {
    const total =
      weights.genreSimilarity +
      weights.audioFeatures +
      weights.moodSimilarity +
      weights.arousalSimilarity +
      weights.danceabilitySimilarity +
      weights.instrumentalnessSimilarity +
      weights.voiceSimilarity +
      weights.instrumentsSimilarity;
    expect(total).toBeLessThan(1.0);
  });
});
