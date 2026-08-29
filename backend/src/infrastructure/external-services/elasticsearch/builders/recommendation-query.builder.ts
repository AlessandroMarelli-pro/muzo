import type { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import type { RecommendationCriteria } from 'src/kernel/types/model-types';

const EMBEDDING_DIM = 1280;

function isValidEmbeddingVector(vector: number[] | undefined): vector is number[] {
  if (!vector || vector.length !== EMBEDDING_DIM) {
    return false;
  }
  return vector.every((v) => Number.isFinite(v));
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
 * (cosine similarity script). This mirrors what the ai-service's v2 pipeline
 * actually produces -- there is no more spectral/MFCC/chroma data to score on.
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

  const baseBool: Record<string, unknown> = {
    must_not: [{ terms: { trackId: excludeTrackIds } }],
    must: [{ match_all: {} }],
  };

  const embeddingVec = playlistFeatures.embedding;
  /**
   * Virtually every track now has a discogs_embedding (backfilled), so this is a
   * straight cosine similarity. The doc.size() check stays as a one-line guard: a
   * doc still missing the field (never analyzed / not yet backfilled) would
   * otherwise throw and fail scoring for the whole query, not just that document.
   */
  const embeddingSimilarityScriptSource = `def v = doc['audio_features.discogs_embedding'];
if (v.size() != ${EMBEDDING_DIM}) {
  return 1.0;
}
return cosineSimilarity(params.queryVector, 'audio_features.discogs_embedding') + 1.0;`;
  const useEmbeddingScript =
    wAudio > 0 &&
    isValidEmbeddingVector(embeddingVec) &&
    process.env.ELASTICSEARCH_EMBEDDING_VECTOR_SIMILARITY !== 'false';
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
  if (useEmbeddingScript) {
    // Weighted higher (35.0 default) than the term/gauss signals above: a
    // 1280-dim learned discogs-effnet embedding captures genre/style similarity
    // far more accurately than hand-picked scalar features, so it dominates the
    // acoustic-similarity portion of the score. Tunable via
    // ELASTICSEARCH_EMBEDDING_VECTOR_WEIGHT without a redeploy.
    const embeddingWeightMultiplier = parseFloat(
      process.env.ELASTICSEARCH_EMBEDDING_VECTOR_WEIGHT || '35.0',
    );
    outerShould.push({
      script_score: {
        query: { match_all: {} },
        script: {
          source: embeddingSimilarityScriptSource,
          params: { queryVector: embeddingVec },
        },
        boost: wAudio * embeddingWeightMultiplier,
      },
    });
  }

  return {
    size: candidatePoolSize,
    query: {
      bool: {
        must_not: [{ terms: { trackId: excludeTrackIds } }],
        should: outerShould,
        minimum_should_match: 1,
      },
    },
    highlight: {
      fields: {
        genres: {},
        subgenres: {},
        tags: {},
        atmosphere_tags: {},
      },
      require_field_match: false,
    },
  };
};
