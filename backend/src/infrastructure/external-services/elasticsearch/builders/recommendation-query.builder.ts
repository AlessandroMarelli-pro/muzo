import type { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import type { RecommendationCriteria } from 'src/kernel/types/model-types';
import {
  categoricalMoodFunctions,
  genreFunctions,
  instrumentFunctions,
  moodFunctions,
  scalarFunction,
  tempoFunction,
  voiceFunction,
} from './recommendation-scoring-functions';
import { embeddingScoreScript, seedEmbeddingVectors } from './recommendation-seed-scripts';

/**
 * Builds the Elasticsearch body for feature-based recommendations.
 *
 * The 1280-dim discogs-effnet embedding cosine similarity is ALWAYS the score
 * base -- an always-matching `script_score` function with weight 1.0. Every
 * other signal (genre/subgenre, tempo, mood, arousal, danceability,
 * voice/instrumentalness, instruments) is a bounded additive boost expressed
 * as a small fraction of that base (see recommendation-scoring-functions.ts
 * and defaults.ts DEFAULT_RECOMMENDATION_WEIGHTS), so the embedding always
 * dominates ranking and the boosts only reorder within a similarity band.
 *
 * This replaces an earlier design that combined a magic-number function_score
 * (100+ points) with a separate top-level `knn` block in an outer `should` --
 * the two were on incomparable scales, so the embedding (meant to be the best
 * signal) contributed under 10% of the total score. It also replaces the
 * per-seed-knn-clause "good-enough max-similarity approximation": this
 * cluster runs an Elasticsearch Basic licence, so the `linear`/`rrf`
 * retrievers that would normally do this composition are unavailable
 * (verified: HTTP 403 "license is non-compliant"). Instead the base is an
 * EXACT brute-force `script_score` cosine over every candidate -- measured at
 * 15-220ms across this ~7.7k track corpus, cheap enough at this scale that no
 * approximation is needed. Revisit if the library grows towards ~100k tracks.
 *
 * `boost_mode: 'replace'` is required, not `'sum'`: with `sum` the outer
 * query's constant 1.0 leaks back into every score. It also avoids a proven
 * function_score pitfall: a document matching NO function scores 1.0 (`"no
 * function matched"`), not 0 -- with `boost_mode: 'replace'` this is safe
 * because the embedding script_score always matches every candidate that has
 * an embedding.
 *
 * The `exists` filter on the embedding field is MANDATORY, not defensive:
 * without it, any candidate missing `audio_features.discogs_embedding` throws
 * a Painless runtime error that fails the entire shard (reproduced against
 * the live cluster), not just that one document.
 *
 * See recommendation-seed-scripts.ts for why the per-seed cosine calls are
 * fully unrolled rather than looped over `params.seeds[i]` -- a real
 * Elasticsearch vector-scripting bug, not a style choice.
 */
export const buildElasticsearchRecommendationQuery = (
  playlistFeatures: AudioFeatures,
  criteria: RecommendationCriteria,
) => {
  const { weights, excludeTrackIds } = criteria;
  const excluded = excludeTrackIds ?? [];
  const limit = criteria.limit ?? 50;
  const candidatePoolSize = Math.min(Math.max(limit * 3, 150), 500);

  const functions: unknown[] = [];

  const seedVectors = seedEmbeddingVectors(playlistFeatures);
  const useEmbeddingBase =
    seedVectors.length > 0 && process.env.ELASTICSEARCH_EMBEDDING_VECTOR_SIMILARITY !== 'false';
  if (useEmbeddingBase) {
    const strategy = criteria.seedStrategy ?? 'mean';
    const { source, params } = embeddingScoreScript(strategy, seedVectors);
    functions.push({
      script_score: {
        script: { source, params },
      },
      weight: 1.0,
    });
  }

  functions.push(...genreFunctions(playlistFeatures, weights.genreSimilarity));

  const tempo = tempoFunction(playlistFeatures, weights.audioFeatures);
  if (tempo) {
    functions.push(tempo);
  }

  const arousal = scalarFunction('arousal', playlistFeatures.arousal, weights.arousalSimilarity);
  if (arousal) {
    functions.push(arousal);
  }
  const danceability = scalarFunction(
    'danceability',
    playlistFeatures.danceability,
    weights.danceabilitySimilarity,
  );
  if (danceability) {
    functions.push(danceability);
  }

  functions.push(...moodFunctions(playlistFeatures, weights.moodSimilarity));
  functions.push(...categoricalMoodFunctions(playlistFeatures, weights.moodSimilarity));

  const voice = voiceFunction(playlistFeatures, weights);
  if (voice) {
    functions.push(voice);
  }

  functions.push(...instrumentFunctions(playlistFeatures, weights.instrumentsSimilarity));

  // Only required when the base script_score actually runs: it dereferences
  // the vector field, and a document missing it throws a Painless runtime
  // error that fails the whole shard (reproduced). When there's no usable
  // embedding (or the kill-switch is set), skip the guard entirely so
  // scoring degrades gracefully to boosts-only over every candidate instead
  // of matching nothing.
  const filter: unknown[] = useEmbeddingBase
    ? [{ exists: { field: 'audio_features.discogs_embedding' } }]
    : [];

  return {
    size: candidatePoolSize,
    query: {
      function_score: {
        query: {
          bool: {
            filter,
            must_not: [{ terms: { trackId: excluded } }],
          },
        },
        functions,
        score_mode: 'sum',
        boost_mode: 'replace',
      },
    },
    highlight: {
      fields: {
        genres: {},
        subgenres: {},
      },
      require_field_match: false,
    },
  };
};
