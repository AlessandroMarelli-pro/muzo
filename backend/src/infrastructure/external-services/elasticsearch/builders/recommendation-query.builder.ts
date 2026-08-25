import type { AudioFeatures, SpectralFeatures } from 'src/application/ports/dtos/AudioFeatures';
import type { AggregationStatistics, RecommendationCriteria } from 'src/kernel/types/model-types';

import { getCamelotNeighbors } from './camelot-neighbors';

type SpectralDecayOptions = {
  minScale?: number;
  fallbackScale: number;
  offset: number;
  decay: number;
};

/** Elasticsearch gauss decay requires scale strictly greater than 0. */
function ensurePositiveGaussScale(scale: number, fallback: number): number {
  const fb = Number.isFinite(fallback) && fallback > 0 ? fallback : 1e-6;
  const raw = Number.isFinite(scale) && scale > 0 ? scale : fb;
  return Math.max(raw, 1e-6);
}

function buildSpectralDecayClauses(
  esFieldPrefix: string,
  stats: AggregationStatistics,
  options: SpectralDecayOptions,
  weightMultiplier: number,
): unknown[] {
  const { minScale = 0, fallbackScale, offset, decay } = options;
  return Object.entries(stats).map(([key, value]) => {
    const rawScale =
      key === 'mean' && stats.std != null ? Math.max(stats.std, minScale) : fallbackScale;
    const scale = ensurePositiveGaussScale(rawScale, fallbackScale);
    const origin = Number.isFinite(Number(value)) ? Number(value) : 0;
    return {
      gauss: {
        [`${esFieldPrefix}.${key}`]: {
          origin,
          scale,
          decay,
          offset,
        },
      },
      weight: 3 * weightMultiplier,
    };
  });
}

const SPECTRAL_AGG_FEATURES: ReadonlyArray<{
  key: keyof SpectralFeatures;
  esSegment: string;
  options: SpectralDecayOptions;
}> = [
  {
    key: 'spectralCentroidMean',
    esSegment: 'spectral_features.spectral_centroid',
    options: { minScale: 200, fallbackScale: 800, offset: 80, decay: 0.5 },
  },
  {
    key: 'spectralRolloffMean',
    esSegment: 'spectral_features.spectral_rolloff',
    options: { minScale: 200, fallbackScale: 1000, offset: 100, decay: 0.5 },
  },
  {
    key: 'spectralSpreadMean',
    esSegment: 'spectral_features.spectral_spread',
    options: { minScale: 100, fallbackScale: 500, offset: 50, decay: 0.5 },
  },
  {
    key: 'spectralBandwidthMean',
    esSegment: 'spectral_features.spectral_bandwidth',
    options: { minScale: 5000, fallbackScale: 20000, offset: 500, decay: 0.5 },
  },
  {
    key: 'spectralFlatnessMean',
    esSegment: 'spectral_features.spectral_flatness',
    options: { fallbackScale: 0.08, offset: 0.01, decay: 0.5 },
  },
  {
    key: 'zeroCrossingRateMean',
    esSegment: 'spectral_features.zero_crossing_rate',
    options: { fallbackScale: 0.05, offset: 0.005, decay: 0.5 },
  },
  {
    key: 'spectralContrastMean',
    esSegment: 'spectral_features.spectral_contrast',
    options: { fallbackScale: 5, offset: 0.5, decay: 0.5 },
  },
];

function isValidMfccVector(vector: number[] | undefined): vector is number[] {
  if (!vector || vector.length !== 13) {
    return false;
  }
  return vector.every((v) => Number.isFinite(v));
}

const EMBEDDING_DIM = 1280;

function isValidEmbeddingVector(vector: number[] | undefined): vector is number[] {
  if (!vector || vector.length !== EMBEDDING_DIM) {
    return false;
  }
  return vector.every((v) => Number.isFinite(v));
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
 * **Before re-index / re-analyze:** MFCC cosine similarity is wrapped in Painless try/catch so a
 * legacy `keyword` mapping or missing field does not fail the whole query. Set
 * `ELASTICSEARCH_MFCC_VECTOR_SIMILARITY=false` to omit the MFCC script entirely. Gauss decay on
 * optional numeric fields typically degrades gracefully when values are missing on documents.
 */
export const buildElasticsearchRecommendationQuery = (
  playlistFeatures: AudioFeatures,
  criteria: RecommendationCriteria,
) => {
  const { weights, excludeTrackIds } = criteria;
  const wGenre = weights.genreSimilarity;
  const wAudio = weights.audioSimilarity;
  const wAi = weights.aiMetadataSimilarity;
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

  const camelotNeighbors = getCamelotNeighbors(playlistFeatures.camelotKey);
  if (wAudio > 0 && camelotNeighbors.length > 0) {
    functions.push({
      filter: { terms: { 'musical_audio_features.camelot_key': camelotNeighbors } },
      weight: wAudio * 22.0,
    });
  }

  if (
    wAi > 0 &&
    playlistFeatures.atmosphereKeywords &&
    playlistFeatures.atmosphereKeywords.length > 0
  ) {
    for (const keyword of playlistFeatures.atmosphereKeywords) {
      functions.push({
        filter: { term: { atmosphere_tags: keyword } },
        weight: wAi * 4.0,
      });
    }
  }

  if (wAi > 0 && playlistFeatures.aiTags && playlistFeatures.aiTags.length > 0) {
    for (const tag of playlistFeatures.aiTags) {
      functions.push({
        filter: { term: { tags: tag } },
        weight: wAi * 4.0,
      });
    }
  }

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

  if (
    wAudioFeat > 0 &&
    playlistFeatures.valence != null &&
    Number.isFinite(playlistFeatures.valence)
  ) {
    functions.push({
      gauss: {
        'musical_audio_features.valence': {
          origin: playlistFeatures.valence,
          scale: 0.18,
          offset: 0.04,
          decay: 0.5,
        },
      },
      weight: wAudioFeat * 10.0,
    });
  }
  if (
    wAudioFeat > 0 &&
    playlistFeatures.arousal != null &&
    Number.isFinite(playlistFeatures.arousal)
  ) {
    functions.push({
      gauss: {
        'musical_audio_features.arousal': {
          origin: playlistFeatures.arousal,
          scale: 0.18,
          offset: 0.04,
          decay: 0.5,
        },
      },
      weight: wAudioFeat * 10.0,
    });
  }
  if (
    wAudioFeat > 0 &&
    playlistFeatures.danceability != null &&
    Number.isFinite(playlistFeatures.danceability)
  ) {
    functions.push({
      gauss: {
        'musical_audio_features.danceability': {
          origin: playlistFeatures.danceability,
          scale: 0.18,
          offset: 0.04,
          decay: 0.5,
        },
      },
      weight: wAudioFeat * 10.0,
    });
  }
  if (
    wAudioFeat > 0 &&
    playlistFeatures.energy != null &&
    Number.isFinite(playlistFeatures.energy)
  ) {
    functions.push({
      gauss: {
        'musical_audio_features.energy': {
          origin: playlistFeatures.energy,
          scale: 0.2,
          offset: 0.05,
          decay: 0.5,
        },
      },
      weight: wAudioFeat * 8.0,
    });
  }

  const spectralFeatures = playlistFeatures.spectralFeatures;
  if (wAudio > 0 && spectralFeatures) {
    for (const { key, esSegment, options } of SPECTRAL_AGG_FEATURES) {
      const stats = spectralFeatures[key];
      if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
        continue;
      }
      functions.push(...buildSpectralDecayClauses(esSegment, stats, options, wAudio));
    }
  }

  if (
    wAudio > 0 &&
    playlistFeatures.onsetDensity != null &&
    Number.isFinite(playlistFeatures.onsetDensity)
  ) {
    functions.push({
      gauss: {
        'spectral_features.onset_density': {
          origin: playlistFeatures.onsetDensity,
          scale: 2.5,
          offset: 0.3,
          decay: 0.5,
        },
      },
      weight: wAudio * 6.0,
    });
  }
  if (
    wAudio > 0 &&
    playlistFeatures.dynamicRange != null &&
    Number.isFinite(playlistFeatures.dynamicRange)
  ) {
    functions.push({
      gauss: {
        'spectral_features.dynamic_range': {
          origin: playlistFeatures.dynamicRange,
          scale: 0.08,
          offset: 0.01,
          decay: 0.5,
        },
      },
      weight: wAudio * 5.0,
    });
  }
  if (
    wAudio > 0 &&
    playlistFeatures.bassPresence != null &&
    Number.isFinite(playlistFeatures.bassPresence)
  ) {
    functions.push({
      gauss: {
        'spectral_features.bass_presence': {
          origin: playlistFeatures.bassPresence,
          scale: 0.2,
          offset: 0.05,
          decay: 0.5,
        },
      },
      weight: wAudio * 6.0,
    });
  }

  const bands = playlistFeatures.energyByBand;
  if (wAudio > 0 && bands && bands.length === 3) {
    const labels = ['bass', 'mid', 'high'] as const;
    for (let i = 0; i < 3; i += 1) {
      const v = bands[i];
      if (!Number.isFinite(v)) {
        continue;
      }
      functions.push({
        gauss: {
          [`spectral_features.energy_by_band.${labels[i]}`]: {
            origin: v,
            scale: ensurePositiveGaussScale(Math.abs(v) * 0.35, 5),
            offset: 2,
            decay: 0.5,
          },
        },
        weight: wAudio * 2.5,
      });
    }
  }
  const ratios = playlistFeatures.energyRatios;
  if (wAudio > 0 && ratios && ratios.length === 3) {
    const rlabels = ['bass', 'mid', 'high'] as const;
    for (let i = 0; i < 3; i += 1) {
      const v = ratios[i];
      if (!Number.isFinite(v)) {
        continue;
      }
      functions.push({
        gauss: {
          [`spectral_features.energy_ratios.${rlabels[i]}`]: {
            origin: v,
            scale: 0.12,
            offset: 0.02,
            decay: 0.5,
          },
        },
        weight: wAudio * 4.0,
      });
    }
  }

  if (
    wAudio > 0 &&
    playlistFeatures.chromaDominantPitch != null &&
    Number.isInteger(playlistFeatures.chromaDominantPitch)
  ) {
    functions.push({
      filter: {
        term: { chroma_dominant_pitch: playlistFeatures.chromaDominantPitch },
      },
      weight: wAudio * 8.0,
    });
  }

  const limit = criteria.limit ?? 50;
  const candidatePoolSize = Math.min(Math.max(limit * 3, 150), 500);

  const baseBool: Record<string, unknown> = {
    must_not: [{ terms: { trackId: excludeTrackIds } }],
    must: [{ match_all: {} }],
  };

  const mfccVec = spectralFeatures?.mfccMean;
  /**
   * MFCC vector scoring requires `spectral_features.mfcc_mean` as a dense_vector in the index.
   * Before re-index/re-analyze, the field may be missing or a different type; Painless must not
   * throw or the entire search fails. Neutral score 1.0 matches the previous branch behavior.
   */
  const mfccSimilarityScriptSource = `try {
  def v = doc['spectral_features.mfcc_mean'];
  if (v.size() != 13) {
    return 1.0;
  }
  return cosineSimilarity(params.queryVector, 'spectral_features.mfcc_mean') + 1.0;
} catch (Exception e) {
  return 1.0;
}`;
  const useMfccScript =
    wAudio > 0 &&
    isValidMfccVector(mfccVec) &&
    process.env.ELASTICSEARCH_MFCC_VECTOR_SIMILARITY !== 'false';

  const embeddingVec = spectralFeatures?.embedding;
  /**
   * Discogs-effnet embedding scoring requires `spectral_features.discogs_embedding` as a
   * dense_vector in the index. Older documents (indexed before this field existed) won't have
   * it; Painless must not throw or the entire search fails. Neutral score 1.0 matches the MFCC
   * script's degrade behavior.
   */
  const embeddingSimilarityScriptSource = `try {
  def v = doc['spectral_features.discogs_embedding'];
  if (v.size() != ${EMBEDDING_DIM}) {
    return 1.0;
  }
  return cosineSimilarity(params.queryVector, 'spectral_features.discogs_embedding') + 1.0;
} catch (Exception e) {
  return 1.0;
}`;
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
  if (useMfccScript) {
    // `boost` must live inside `script_score`; a sibling `boost` next to `script_score` is invalid JSON for bool.should.
    outerShould.push({
      script_score: {
        query: { match_all: {} },
        script: {
          source: mfccSimilarityScriptSource,
          params: { queryVector: mfccVec },
        },
        boost: wAudio * 15.0,
      },
    });
  }
  if (useEmbeddingScript) {
    // Weighted higher than the MFCC script (15.0): a 1280-dim learned discogs-effnet
    // embedding captures genre/style similarity far more accurately than 13-dim MFCC,
    // so it dominates the acoustic-similarity portion of the score. Tunable via
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
