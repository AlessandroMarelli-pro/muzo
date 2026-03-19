import type { SpectralFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import type { AggregationStatistics, RecommendationCriteria } from 'src/kernel/types/model-types';

type SpectralDecayOptions = {
  minScale?: number;
  fallbackScale: number;
  offset: number;
  decay: number;
};

/**
 * Builds Elasticsearch function_score (gauss decay) clauses for one spectral
 * feature. One clause per aggregation stat (mean, std, median, ...).
 * Uses std as scale for the "mean" stat when available; otherwise fallbackScale.
 */
function buildSpectralDecayClauses(
  esFieldPrefix: string,
  stats: AggregationStatistics,
  options: SpectralDecayOptions,
): unknown[] {
  const { minScale = 0, fallbackScale, offset, decay } = options;

  return Object.entries(stats).map(([key, value]) => {
    const scale =
      key === 'mean' && stats.std != null ? Math.max(stats.std, minScale) : fallbackScale;
    return {
      function_score: {
        query: { match_all: {} },
        functions: [
          {
            gauss: {
              [`${esFieldPrefix}.${key}`]: {
                origin: value,
                scale,
                decay,
                offset,
              },
            },
            weight: 3,
          },
        ],
        score_mode: 'sum' as const,
        boost_mode: 'multiply' as const,
      },
    };
  });
}

/** Spectral features that use AggregationStatistics (excludes mfccMean). */
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
];

export const buildElasticsearchRecommendationQuery = (
  playlistFeatures: AudioFeatures,
  criteria: RecommendationCriteria,
) => {
  const { weights, excludeTrackIds } = criteria;

  const shouldGenre =
    weights.genreSimilarity > 0 && playlistFeatures.genres && playlistFeatures.genres.length > 0
      ? {
          bool: {
            should: playlistFeatures.genres.map((genre) => ({
              term: {
                genres: {
                  value: genre,
                  boost: weights.genreSimilarity * 30.0,
                },
              },
            })),
            minimum_should_match: Math.max(playlistFeatures.genres.length, 1),

            boost: weights.genreSimilarity * 30.0,
          },
        }
      : null;
  const shouldSubgenre =
    weights.genreSimilarity > 0 &&
    playlistFeatures.subgenres &&
    playlistFeatures.subgenres.length >= 0
      ? {
          bool: {
            should: playlistFeatures.subgenres.map((subgenre) => ({
              term: {
                subgenres: {
                  value: subgenre,
                  boost: weights.genreSimilarity * 40.0,
                },
              },
            })),
            minimum_should_match: Math.max(playlistFeatures.subgenres.length, 1),
            boost: weights.genreSimilarity * 40.0,
          },
        }
      : null;

  const shouldAtmosphere =
    weights.aiMetadataSimilarity > 0 &&
    playlistFeatures.atmosphereKeywords &&
    playlistFeatures.atmosphereKeywords.length > 0
      ? {
          bool: {
            should: playlistFeatures.atmosphereKeywords.map((keyword) => ({
              term: {
                atmosphere_tags: {
                  value: keyword,
                  boost: weights.aiMetadataSimilarity * 2.0,
                },
              },
            })),
            minimum_should_match: 1,
          },
        }
      : null;

  const shouldTags =
    weights.aiMetadataSimilarity > 0 &&
    playlistFeatures.aiTags &&
    playlistFeatures.aiTags.length > 0
      ? {
          bool: {
            should: playlistFeatures.aiTags.map((tag) => ({
              term: {
                tags: {
                  value: tag,
                  boost: weights.aiMetadataSimilarity * 2.0,
                },
              },
            })),
            minimum_should_match: 1,
          },
        }
      : null;
  const spectralFeatures = playlistFeatures.spectralFeatures;

  const shouldSpectral = (
    weights.audioSimilarity > 0 && spectralFeatures
      ? SPECTRAL_AGG_FEATURES.flatMap(({ key, esSegment, options }) => {
          const stats = spectralFeatures[key];
          if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
            return [];
          }
          return buildSpectralDecayClauses(esSegment, stats, options);
        })
      : []
  ) as unknown[];

  // Global score = sum of genre + subgenre + tempo only (no atmosphere, tags, spectral)
  const should = [
    shouldGenre,
    shouldSubgenre,
    //shouldAtmosphere,
    //shouldTags,
    ...shouldSpectral,
  ].filter((s) => s !== null);

  // Maximum diversity: require only one clause to match so results can be strong on
  // genre only, tempo only, subgenre only, or any combination
  const minimumShouldMatch = 2;

  // Request more candidates than needed so we rank over a larger set and return
  // the true top N (avoids cutting off better matches that tie or sit just below the cutoff)
  const limit = criteria.limit ?? 50;
  const candidatePoolSize = Math.min(Math.max(limit * 3, 150), 500);

  return {
    size: candidatePoolSize,
    query: {
      bool: {
        must_not: [{ terms: { trackId: excludeTrackIds } }],
        must: [
          {
            range: {
              'musical_audio_features.tempo': {
                gte: playlistFeatures.tempo?.min ?? 0,
                lte: playlistFeatures.tempo?.max ?? 200,
              },
            },
          },
        ],
        should,
        minimum_should_match: minimumShouldMatch,
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
