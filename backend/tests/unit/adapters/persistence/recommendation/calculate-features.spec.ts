import { describe, expect, it } from 'vitest';

import { calculateFeatures } from 'src/adapters/persistence/recommendation/calculate-features';
import type { MusicTrack } from 'src/kernel/types';

const EMBEDDING_DIM = 1280;
const vec = (fill: number): number[] => new Array(EMBEDDING_DIM).fill(fill);

const track = (id: string, embedding?: number[]): MusicTrack =>
  ({
    id: `MusicTrack:${id}`,
    artist: 'artist',
    metadata: { genres: ['electronic'], subgenres: ['trance'] },
    features: {
      embedding,
      musicalFeatures: { tempo: 130, valence: 0.5 },
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
