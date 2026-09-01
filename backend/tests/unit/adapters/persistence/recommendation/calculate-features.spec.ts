import { describe, expect, it } from 'vitest';

import { calculateFeatures } from 'src/adapters/persistence/recommendation/calculate-features';
import type { MusicTrack } from 'src/kernel/types';

const EMBEDDING_DIM = 1280;
const vec = (fill: number): number[] => new Array(EMBEDDING_DIM).fill(fill);

const track = (
  id: string,
  embedding?: number[],
  overrides?: {
    musicalFeatures?: Record<string, unknown>;
    instruments?: { instrument: string; confidence: number }[];
  },
): MusicTrack =>
  ({
    id: `MusicTrack:${id}`,
    artist: 'artist',
    metadata: { genres: ['electronic'], subgenres: ['trance'] },
    features: {
      embedding,
      musicalFeatures: { tempo: 130, valence: 0.5, ...overrides?.musicalFeatures },
      instruments: overrides?.instruments,
    },
  }) as unknown as MusicTrack;

describe('calculateFeatures — per-seed embeddings', () => {
  it('collects one entry per seed track that has a vector', () => {
    const result = calculateFeatures([
      track('a', vec(0.1)),
      track('b', vec(0.2)),
      track('c'), // no embedding
      track('d', vec(0.3)),
    ]);

    expect(result?.embeddings).toHaveLength(3);
    for (const e of result!.embeddings!) {
      expect(e).toHaveLength(EMBEDDING_DIM);
    }
  });

  it('still computes the centroid embedding', () => {
    const result = calculateFeatures([track('a', vec(0.2)), track('b', vec(0.4))]);
    expect(result?.embedding).toHaveLength(EMBEDDING_DIM);
    expect(result?.embedding?.[0]).toBeCloseTo(0.3);
  });

  it('caps the per-seed list at 10', () => {
    const tracks = Array.from({ length: 15 }, (_, i) => track(`t${i}`, vec(i / 100)));
    const result = calculateFeatures(tracks);
    expect(result?.embeddings).toHaveLength(10);
  });

  it('returns an empty list when no track has an embedding', () => {
    const result = calculateFeatures([track('a'), track('b')]);
    expect(result?.embeddings).toEqual([]);
  });
});

describe('calculateFeatures — valence/danceability/arousal mean', () => {
  it('averages over tracks that actually had the value, not tracks.length', () => {
    // 1 of 2 seeds lacks valence -- the mean must be 0.8 (from the single
    // present value), not 0.4 (0.8 / 2 tracks), which would bias the gauss
    // origin toward 0 whenever any seed is missing the feature.
    const result = calculateFeatures([
      track('a', undefined, { musicalFeatures: { valence: 0.8 } }),
      track('b', undefined, { musicalFeatures: { valence: undefined } }),
    ]);
    expect(result?.valence).toBeCloseTo(0.8);
  });

  it('same fix applies to danceability and arousal', () => {
    const result = calculateFeatures([
      track('a', undefined, { musicalFeatures: { danceability: 0.9, arousal: 0.6 } }),
      track('b', undefined, { musicalFeatures: { danceability: undefined, arousal: undefined } }),
    ]);
    expect(result?.danceability).toBeCloseTo(0.9);
    expect(result?.arousal).toBeCloseTo(0.6);
  });
});

describe('calculateFeatures — instrument aggregation', () => {
  it('aggregates by confidence share, favouring high-confidence rare instruments over near-universal ones', () => {
    const result = calculateFeatures([
      track('a', undefined, {
        instruments: [
          { instrument: 'bass', confidence: 0.2 },
          { instrument: 'saxophone', confidence: 0.8 },
        ],
      }),
      track('b', undefined, {
        instruments: [{ instrument: 'bass', confidence: 0.2 }],
      }),
    ]);
    expect(result?.instruments?.[0].instrument).toBe('saxophone');
  });

  it('shares sum to ~1', () => {
    const result = calculateFeatures([
      track('a', undefined, {
        instruments: [
          { instrument: 'bass', confidence: 0.4 },
          { instrument: 'drums', confidence: 0.4 },
        ],
      }),
    ]);
    const total = result?.instruments?.reduce((sum, i) => sum + i.weight, 0) ?? 0;
    expect(total).toBeCloseTo(1);
  });

  it('caps at 6 instruments', () => {
    const result = calculateFeatures([
      track('a', undefined, {
        instruments: Array.from({ length: 10 }, (_, i) => ({
          instrument: `inst${i}`,
          confidence: 0.5,
        })),
      }),
    ]);
    expect(result?.instruments).toHaveLength(6);
  });

  it('returns an empty list when no track has instruments', () => {
    const result = calculateFeatures([track('a'), track('b')]);
    expect(result?.instruments).toEqual([]);
  });
});
