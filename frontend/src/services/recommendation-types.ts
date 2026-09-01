/**
 * Mirrors backend src/kernel/types/model-types.ts. The backend exposes both
 * as plain GraphQL `String`/`[String!]` args (no server-side enum), so these
 * stay hand-kept in sync rather than generated.
 */
export type RecommendationSeedStrategy = 'mean' | 'max';

/** Boost keys the "Boost similarity by" UI can select -- must match backend
 * ACTIVE_RECOMMENDATION_BOOST_KEYS exactly; an unrecognized key is silently
 * ignored server-side rather than erroring. */
export const RECOMMENDATION_BOOSTS = [
  { key: 'genreSimilarity', label: 'Genre' },
  { key: 'audioFeatures', label: 'Tempo' },
  { key: 'moodSimilarity', label: 'Mood' },
  { key: 'arousalSimilarity', label: 'Arousal' },
  { key: 'danceabilitySimilarity', label: 'Danceability' },
  { key: 'instrumentalnessSimilarity', label: 'Instrumentalness' },
  { key: 'voiceSimilarity', label: 'Voice' },
  { key: 'instrumentsSimilarity', label: 'Instruments' },
] as const;

export type RecommendationBoostKey = (typeof RECOMMENDATION_BOOSTS)[number]['key'];
