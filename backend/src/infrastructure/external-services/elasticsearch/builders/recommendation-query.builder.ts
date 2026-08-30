import type { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import type { RecommendationCriteria } from 'src/kernel/types/model-types';

const EMBEDDING_DIM = 1280;

function isValidEmbeddingVector(vector: number[] | undefined): vector is number[] {
  if (!vector || vector.length !== EMBEDDING_DIM) {
    return false;
  }
  return vector.every((v) => Number.isFinite(v));
}

/**
 * Valid per-seed embedding vectors for the kNN search. Prefers the per-seed list
 * (`embeddings`); falls back to the centroid (`embedding`) so single-track
 * recommendations still issue a 1-element kNN. Returns [] when nothing is usable.
 */
function seedEmbeddingVectors(playlistFeatures: AudioFeatures): number[][] {
  const perSeed = (playlistFeatures.embeddings ?? []).filter(isValidEmbeddingVector);
  if (perSeed.length > 0) {
    return perSeed;
  }
  return isValidEmbeddingVector(playlistFeatures.embedding) ? [playlistFeatures.embedding] : [];
}

/** Elasticsearch gauss decay requires scale strictly greater than 0. */
function ensurePositiveGaussScale(scale: number, fallback: number): number {
  const fb = Number.isFinite(fallback) && fallback > 0 ? fallback : 1e-6;
  const raw = Number.isFinite(scale) && scale > 0 ? scale : fb;
  return Math.max(raw, 1e-6);
}

function tempoOriginAndScale(playlistFeatures: {
  tempo?: { min: number; max: number };
  tempoCenter?: number;
}): { origin: number; scale: number } {
  const { tempo, tempoCenter } = playlistFeatures;
  if (tempoCenter != null && Number.isFinite(tempoCenter) && tempoCenter > 0) {
    return { origin: tempoCenter, scale: 18 };
  }
  if (
    tempo != null &&
    Number.isFinite(tempo.min) &&
    Number.isFinite(tempo.max) &&
    tempo.max > 0 &&
    tempo.min < Infinity
  ) {
    const origin = (tempo.min + tempo.max) / 2;
    const halfSpan = Math.max((tempo.max - tempo.min) / 2, 8);
    return { origin, scale: Math.min(halfSpan + 6, 40) };
  }
  return { origin: 120, scale: 25 };
}

/**
 * Builds the Elasticsearch body for feature-based recommendations.
 *
 * Scoring signals: genre/subgenre term matches, tempo (gauss decay), mood/voice/
 * instrumentalness (gauss decay), and the 1280-dim discogs-effnet embedding
 * (native multi-kNN, one clause per seed track). This mirrors what the
 * ai-service's v2 pipeline actually produces -- there is no more
 * spectral/MFCC/chroma data to score on.
 */
export const buildElasticsearchRecommendationQuery = (
  playlistFeatures: AudioFeatures,
  criteria: RecommendationCriteria,
) => {
  const { weights, excludeTrackIds } = criteria;
  const wGenre = weights.genreSimilarity;
  const wAudio = weights.audioSimilarity;
  const wAudioFeat = weights.audioFeatures;

  const functions: unknown[] = [];

  if (wGenre > 0 && playlistFeatures.genres && playlistFeatures.genres.length > 0) {
    for (const genre of playlistFeatures.genres) {
      functions.push({
        filter: { term: { genres: genre } },
        weight: wGenre * 35.0,
      });
    }
  }

  if (wGenre > 0 && playlistFeatures.subgenres && playlistFeatures.subgenres.length > 0) {
    for (const subgenre of playlistFeatures.subgenres) {
      functions.push({
        filter: { term: { subgenres: subgenre } },
        weight: wGenre * 45.0,
      });
    }
  }

  const { origin: tempoOriginRaw, scale: tempoScaleRaw } = tempoOriginAndScale(playlistFeatures);
  const tempoOrigin = Number.isFinite(tempoOriginRaw) ? tempoOriginRaw : 120;
  const tempoScale = ensurePositiveGaussScale(tempoScaleRaw, 18);
  functions.push({
    gauss: {
      'musical_audio_features.tempo': {
        origin: tempoOrigin,
        scale: tempoScale,
        offset: 4,
        decay: 0.5,
      },
    },
    weight: Math.max(wAudio, 0.01) * 14.0,
  });

  const gaussFeature = (field: string, value: number | undefined, weight: number) => {
    if (wAudioFeat > 0 && value != null && Number.isFinite(value)) {
      functions.push({
        gauss: {
          [`musical_audio_features.${field}`]: {
            origin: value,
            scale: 0.18,
            offset: 0.04,
            decay: 0.5,
          },
        },
        weight: wAudioFeat * weight,
      });
    }
  };

  gaussFeature('valence', playlistFeatures.valence, 10.0);
  gaussFeature('arousal', playlistFeatures.arousal, 10.0);
  gaussFeature('danceability', playlistFeatures.danceability, 10.0);
  gaussFeature('instrumentalness', playlistFeatures.instrumentalness, 6.0);
  gaussFeature('voice', playlistFeatures.voice, 6.0);
  gaussFeature('mood_happy', playlistFeatures.moodHappy, 4.0);
  gaussFeature('mood_sad', playlistFeatures.moodSad, 4.0);
  gaussFeature('mood_relaxed', playlistFeatures.moodRelaxed, 4.0);
  gaussFeature('mood_aggressive', playlistFeatures.moodAggressive, 4.0);
  gaussFeature('mood_party', playlistFeatures.moodParty, 4.0);

  if (wAudioFeat > 0 && playlistFeatures.valenceMood) {
    functions.push({
      filter: { term: { 'musical_audio_features.valence_mood': playlistFeatures.valenceMood } },
      weight: wAudioFeat * 12.0,
    });
  }
  if (wAudioFeat > 0 && playlistFeatures.arousalMood) {
    functions.push({
      filter: { term: { 'musical_audio_features.arousal_mood': playlistFeatures.arousalMood } },
      weight: wAudioFeat * 12.0,
    });
  }
  if (wAudioFeat > 0 && playlistFeatures.danceabilityFeeling) {
    functions.push({
      filter: {
        term: {
          'musical_audio_features.danceability_feeling': playlistFeatures.danceabilityFeeling,
        },
      },
      weight: wAudioFeat * 12.0,
    });
  }

  const limit = criteria.limit ?? 50;
  const candidatePoolSize = Math.min(Math.max(limit * 3, 150), 500);
  const excluded = excludeTrackIds ?? [];

  const baseBool: Record<string, unknown> = {
    must_not: [{ terms: { trackId: excluded } }],
    must: [{ match_all: {} }],
  };

  const functionScoreQuery: Record<string, unknown> = {
    function_score: {
      query: { bool: baseBool },
      functions,
      score_mode: 'sum',
      boost_mode: 'sum',
      boost: 1,
    },
  };
  const outerShould: unknown[] = [functionScoreQuery];

  /**
   * Native multi-kNN over the HNSW-indexed 1280-dim discogs-effnet vector. One
   * clause per seed track: ES sums the per-clause contributions, but a candidate
   * genuinely close to a single seed still gets a large term from that clause
   * while distant seeds don't surface it at all -- a good-enough max-similarity
   * approximation without a brute-force script_score. Each clause boost is divided
   * by the seed count so total embedding weight stays comparable to the old
   * single-vector behaviour. Weighted high (35.0 default) vs the term/gauss
   * signals: the learned embedding captures genre/style far better than the
   * hand-picked scalars. Tunable via ELASTICSEARCH_EMBEDDING_VECTOR_WEIGHT.
   */
  const seedVectors = seedEmbeddingVectors(playlistFeatures);
  const useEmbeddingKnn =
    wAudio > 0 &&
    seedVectors.length > 0 &&
    process.env.ELASTICSEARCH_EMBEDDING_VECTOR_SIMILARITY !== 'false';
  let knnClauses: unknown[] | undefined;
  if (useEmbeddingKnn) {
    const embeddingWeightMultiplier = parseFloat(
      process.env.ELASTICSEARCH_EMBEDDING_VECTOR_WEIGHT || '35.0',
    );
    const perSeedBoost = (wAudio * embeddingWeightMultiplier) / seedVectors.length;
    knnClauses = seedVectors.map((vec) => ({
      field: 'audio_features.discogs_embedding',
      query_vector: vec,
      k: candidatePoolSize,
      num_candidates: Math.min(candidatePoolSize * 2, 1000),
      boost: perSeedBoost,
      filter: { bool: { must_not: [{ terms: { trackId: excluded } }] } },
    }));
  }

  return {
    size: candidatePoolSize,
    ...(knnClauses ? { knn: knnClauses } : {}),
    query: {
      bool: {
        must_not: [{ terms: { trackId: excluded } }],
        should: outerShould,
        minimum_should_match: 1,
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
