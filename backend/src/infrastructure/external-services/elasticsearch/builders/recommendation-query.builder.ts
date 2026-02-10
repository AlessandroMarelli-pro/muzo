import { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { RecommendationCriteria } from 'src/kernel/types/model-types';

export const buildElasticsearchRecommendationQuery = (
  playlistFeatures: AudioFeatures,
  criteria: RecommendationCriteria,
) => {
  const { weights, excludeTrackIds } = criteria;

  const shouldGenre =
    weights.genreSimilarity > 0 &&
    playlistFeatures.genres &&
    playlistFeatures.genres.length > 0
      ? {
          bool: {
            should: playlistFeatures.genres.map((genre) => ({
              term: {
                genres: {
                  value: genre,
                  boost: weights.genreSimilarity * 3.0,
                },
              },
            })),
            minimum_should_match: 1,
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
                  boost: weights.genreSimilarity * 4.0,
                },
              },
            })),
            minimum_should_match: 1,
          },
        }
      : null;

  const shouldTempo =
    weights.audioFeatures > 0 && playlistFeatures.tempo
      ? {
          function_score: {
            query: { match_all: {} },
            functions: [
              {
                gauss: {
                  'musical_audio_features.tempo': {
                    origin: playlistFeatures.tempo || 120,
                    scale: 10,
                    decay: 0.5,
                    offset: 0,
                  },
                },
                weight: 3,
              },
            ],
            score_mode: 'sum',
            boost_mode: 'multiply',
          },
        }
      : null;

  const should = [shouldGenre, shouldSubgenre, shouldTempo]?.filter(
    (s) => s !== null,
  );
  return {
    size: criteria.limit || 20,
    query: {
      bool: {
        must_not: [{ terms: { trackId: excludeTrackIds } }],
        should,
        // Control scoring behavior to prevent scores exceeding calculated maximum
        minimum_should_match: 1,
      },
    },
    highlight: {
      fields: {
        genres: {},
        subgenres: {},
        ai_tags: {},
        atmosphere_desc: {},
        ai_description: { number_of_fragments: 1, fragment_size: 100 },
        vocals_desc: { number_of_fragments: 1, fragment_size: 100 },
        context_background: { number_of_fragments: 1, fragment_size: 100 },
        context_impact: { number_of_fragments: 1, fragment_size: 100 },
        'musical_audio_features.tempo': {},
      },
      require_field_match: false,
    },
  };
};
