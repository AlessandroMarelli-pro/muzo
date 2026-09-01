import type { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import type { RecommendationSeedStrategy } from 'src/kernel/types/model-types';

const EMBEDDING_DIM = 1280;
const EMBEDDING_FIELD = 'audio_features.discogs_embedding';

function isValidEmbeddingVector(vector: number[] | undefined): vector is number[] {
  if (!vector || vector.length !== EMBEDDING_DIM) {
    return false;
  }
  return vector.every((v) => Number.isFinite(v));
}

/**
 * Valid per-seed embedding vectors for the base cosine score. Prefers the
 * per-seed list (`embeddings`); falls back to the centroid (`embedding`) so
 * single-track recommendations still score against exactly one vector.
 * Returns [] when nothing is usable.
 */
export function seedEmbeddingVectors(playlistFeatures: AudioFeatures): number[][] {
  const perSeed = (playlistFeatures.embeddings ?? []).filter(isValidEmbeddingVector);
  if (perSeed.length > 0) {
    return perSeed;
  }
  return isValidEmbeddingVector(playlistFeatures.embedding) ? [playlistFeatures.embedding] : [];
}

/**
 * Builds the Painless script + params for the embedding base score. EXACT
 * brute-force cosine over every candidate (no kNN/HNSW approximation) --
 * measured at 15-220ms across the ~7.7k track corpus, cheap enough that
 * approximation buys nothing at this scale.
 *
 * The loop body is fully UNROLLED into one literal `cosineSimilarity(params.s0,
 * ...)`, `cosineSimilarity(params.s1, ...)`, ... call per seed, each with its
 * own named param, rather than `cosineSimilarity(params.seeds[i], ...)` inside
 * a `for` loop over an array. This isn't a style choice: reproduced against
 * the live ES 9.1.1 cluster, a loop that calls `cosineSimilarity` with a
 * variable array index silently reuses the FIRST call's query vector on every
 * iteration -- `sum(cos(seeds[i]))` for i in 0..9 came back equal to
 * `10 * cos(seeds[0])`, confirmed via unrolled single-call baselines that
 * matched independently-computed Python cosine values exactly, while any
 * `params.seeds[i]`-in-a-loop form (including copying the element to a local
 * var first) did not. Likely an internal per-call-site vector cache in the ES
 * vector-scripting fast path that assumes a constant query vector per
 * call-site -- exactly what kNN scoring needs, but not what a multi-seed loop
 * is doing here. Each seed therefore gets its own literal call-site instead.
 *
 * Remapped to [0,1] via `(cos + 1) / 2` -- Elasticsearch rejects negative
 * function_score contributions and raw cosine is [-1,1].
 *
 * `mean`: average similarity across seeds, normalized by seed count so the
 * base stays in [0,1] regardless of how many seeds there are. Favours the
 * playlist's centre of mass.
 *
 * `max`: best similarity across any single seed, via nested `Math.max()` over
 * the same unrolled per-seed calls. A track that strongly matches one
 * sub-cluster of an eclectic playlist ranks as high as one matching the
 * average -- exact, unlike the old per-seed-knn-clause approximation this
 * replaces.
 */
export function embeddingScoreScript(
  strategy: RecommendationSeedStrategy,
  seedVectors: number[][],
): { source: string; params: Record<string, number[]> } {
  const params: Record<string, number[]> = {};
  const calls: string[] = [];
  seedVectors.forEach((vector, i) => {
    const paramName = `s${i}`;
    params[paramName] = vector;
    calls.push(`cosineSimilarity(params.${paramName}, '${EMBEDDING_FIELD}')`);
  });

  if (strategy === 'max') {
    const expr = calls.reduce((acc, call) => `Math.max(${acc}, ${call})`);
    return { source: `return (${expr} + 1.0) / 2.0;`, params };
  }

  const sumExpr = calls.join(' + ');
  return { source: `return ((${sumExpr}) / ${calls.length}.0 + 1.0) / 2.0;`, params };
}
