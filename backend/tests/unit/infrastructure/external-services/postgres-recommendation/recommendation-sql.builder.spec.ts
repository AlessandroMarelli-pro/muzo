import { afterEach, describe, expect, it } from 'vitest';

import type { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import type { RecommendationCriteria, RecommendationWeights } from 'src/kernel/types/model-types';
import { buildRecommendationSql } from 'src/infrastructure/external-services/postgres-recommendation/recommendation-sql.builder';

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

const build = (features: AudioFeatures, c: RecommendationCriteria = criteria) =>
  buildRecommendationSql(features, c);

/** Number of distinct pgvector `<=>` comparisons against a literal vector in the SQL text --
 * mirrors the ES spec's seedParamCount (one call site per seed). */
const seedVectorCount = (text: string) => (text.match(/<=>/g) ?? []).length;

/** The seed-combination strategy uses `GREATEST(<similarity expr>, ...)` across `<=>`
 * comparisons -- distinct from the unrelated `GREATEST(0, ...)` inside every gauss term's
 * distance floor, which is present whenever any gauss boost (e.g. tempo) runs. */
const usesMaxSeedStrategy = (text: string) => text.includes('GREATEST((1 -');

/**
 * Regression guard: a bound parameter placeholder (`$1`, `$2`, ...) can never be
 * followed directly by a literal suffix like `.0` in the raw SQL text -- e.g.
 * `${someNumber}.0` inside a Prisma.sql template interpolates as `$3` and then
 * appends `.0` as literal text, producing invalid syntax like `$3.0` that
 * postgres rejects with "syntax error at or near \".0\"". Every numeric
 * interpolation must cast instead (e.g. `${n}::float8`), never rely on a
 * trailing literal decimal.
 */
const hasDanglingPlaceholderSuffix = (text: string) => /\$\d+\.\d/.test(text);

describe('buildRecommendationSql — embedding base', () => {
  it('never produces a placeholder immediately followed by a literal decimal suffix', () => {
    const { sql } = build({ ...baseFeatures(), embeddings: [vec(0.1), vec(0.2), vec(0.3)] });
    expect(hasDanglingPlaceholderSuffix(sql.text)).toBe(false);
  });

  it('emits one <=> comparison per seed vector, combined as a mean', () => {
    const { sql, usedEmbeddingBase } = build({
      ...baseFeatures(),
      embeddings: [vec(0.1), vec(0.2), vec(0.3)],
    });
    expect(usedEmbeddingBase).toBe(true);
    expect(seedVectorCount(sql.text)).toBe(3);
    expect(usesMaxSeedStrategy(sql.text)).toBe(false);
  });

  it('falls back to the centroid embedding as a single-seed base', () => {
    const { sql, usedEmbeddingBase } = build({ ...baseFeatures(), embedding: vec(0.5) });
    expect(usedEmbeddingBase).toBe(true);
    expect(seedVectorCount(sql.text)).toBe(1);
  });

  it('omits the base and the NOT NULL guard when no valid vectors are present', () => {
    const { sql, usedEmbeddingBase } = build(baseFeatures());
    expect(usedEmbeddingBase).toBe(false);
    expect(seedVectorCount(sql.text)).toBe(0);
    expect(sql.text).not.toContain('"embeddingVector" IS NOT NULL');
  });

  it('ignores malformed vectors (wrong dim / non-finite)', () => {
    const { sql } = build({
      ...baseFeatures(),
      embeddings: [vec(0.1), new Array(10).fill(1), [...vec(0.2).slice(1), NaN]],
    });
    expect(seedVectorCount(sql.text)).toBe(1);
  });

  it('requires the NOT NULL guard on the embedding column whenever the base runs', () => {
    const { sql } = build({ ...baseFeatures(), embedding: vec(0.5) });
    expect(sql.text).toContain('"embeddingVector" IS NOT NULL');
  });

  it('excludes trackIds via a NOT IN filter using raw db ids', () => {
    const { sql } = build(
      { ...baseFeatures(), embedding: vec(0.5) },
      { ...criteria, excludeTrackIds: ['MusicTrack:a', 'MusicTrack:b'] as never },
    );
    expect(sql.text).toContain('mt.id NOT IN');
    expect(sql.values).toContain('a');
    expect(sql.values).toContain('b');
  });

  describe('kill-switch: RECOMMENDATION_EMBEDDING_VECTOR_SIMILARITY', () => {
    const ORIGINAL = process.env.RECOMMENDATION_EMBEDDING_VECTOR_SIMILARITY;
    afterEach(() => {
      if (ORIGINAL === undefined) {
        delete process.env.RECOMMENDATION_EMBEDDING_VECTOR_SIMILARITY;
      } else {
        process.env.RECOMMENDATION_EMBEDDING_VECTOR_SIMILARITY = ORIGINAL;
      }
    });

    it('drops the base when set to false', () => {
      process.env.RECOMMENDATION_EMBEDDING_VECTOR_SIMILARITY = 'false';
      const { usedEmbeddingBase, sql } = build({ ...baseFeatures(), embedding: vec(0.5) });
      expect(usedEmbeddingBase).toBe(false);
      expect(seedVectorCount(sql.text)).toBe(0);
    });
  });

  describe('seedStrategy', () => {
    it('defaults to mean (no seed-combination GREATEST) when absent', () => {
      const { sql } = build({ ...baseFeatures(), embeddings: [vec(0.1), vec(0.2)] });
      expect(usesMaxSeedStrategy(sql.text)).toBe(false);
    });

    it('selects GREATEST across seeds when seedStrategy is "max"', () => {
      const { sql } = build(
        { ...baseFeatures(), embeddings: [vec(0.1), vec(0.2)] },
        { ...criteria, seedStrategy: 'max' },
      );
      expect(usesMaxSeedStrategy(sql.text)).toBe(true);
    });
  });
});

describe('buildRecommendationSql — bounded boosts', () => {
  it('omits a boost entirely when its weight is 0', () => {
    const { sql } = build(
      { ...baseFeatures(), embedding: vec(0.5), arousal: 0.6 },
      { ...criteria, weights: { ...weights, arousalSimilarity: 0 } },
    );
    expect(sql.text).not.toContain('af."arousal" -');
  });

  it('omits a scalar boost when the seed value is absent', () => {
    const { sql } = build({ ...baseFeatures(), embedding: vec(0.5) }, criteria);
    expect(sql.text).not.toContain('"danceability" -');
  });

  it('bounds genre boosts to the genreSimilarity weight regardless of match count', () => {
    const { sql } = build(
      { ...baseFeatures(), embedding: vec(0.5), genres: ['rock', 'jazz', 'pop'] },
      criteria,
    );
    const perTermMatches = sql.values.filter((v) => v === weights.genreSimilarity / 3);
    expect(perTermMatches.length).toBe(3);
  });

  it('collapses voice and instrumentalness into exactly one gauss term', () => {
    const { sql } = build(
      { ...baseFeatures(), embedding: vec(0.5), voice: 0.7, instrumentalness: 0.3 },
      criteria,
    );
    const voiceOccurrences = (sql.text.match(/af\."voice"/g) ?? []).length;
    expect(voiceOccurrences).toBe(1);
    expect(sql.values).toContain(weights.voiceSimilarity + weights.instrumentalnessSimilarity);
  });

  it('bounds instrument boosts to the instrumentsSimilarity weight via seed shares', () => {
    const { sql } = build(
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
    expect(sql.values).toContain(weights.instrumentsSimilarity * 0.7);
    expect(sql.values).toContain(weights.instrumentsSimilarity * 0.3);
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
