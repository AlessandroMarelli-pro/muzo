import type {
  ActionContext,
  RecommendationBoostKey,
  RecommendationWeights,
} from 'src/kernel/types/model-types';
import { ACTIVE_RECOMMENDATION_BOOST_KEYS } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';

const ANONYMOUS_ID = models.user.id('anonymous');

export function getAnonymousUser(): ActionContext['user'] {
  return {
    id: ANONYMOUS_ID,
    createdAt: new Date(0),
    createdById: ANONYMOUS_ID,
    updatedAt: new Date(0),
    updatedById: undefined,
    email: 'anonymous@example.com' as ActionContext['user']['email'],
    firstName: 'anonymous',
    lastName: 'anonymous',
  } as ActionContext['user'];
}

export function isAnonymousUser(user: ActionContext['user']): boolean {
  return user.id === ANONYMOUS_ID;
}

/**
 * The embedding cosine similarity is always the score base (implicitly 1.0,
 * not configurable here). Every weight below is the *fraction of that base*
 * a matching criterion can add -- see recommendation-scoring-functions.ts.
 * They intentionally sum to well under 1.0 so the embedding always dominates
 * ranking and the boosts only reorder within a similarity band.
 */
export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  audioSimilarity: 0, // unused: embedding is always the base
  genreSimilarity: 0.1,
  metadataSimilarity: 0, // unused
  userBehavior: 0, // unused
  audioFeatures: 0.08, // tempo
  moodSimilarity: 0.2,
  arousalSimilarity: 0.12,
  danceabilitySimilarity: 0.12,
  instrumentalnessSimilarity: 0.05,
  voiceSimilarity: 0.05,
  instrumentsSimilarity: 0.12,
};

export const ZERO_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  audioSimilarity: 0,
  genreSimilarity: 0,
  metadataSimilarity: 0,
  userBehavior: 0,
  audioFeatures: 0,
  moodSimilarity: 0,
  arousalSimilarity: 0,
  danceabilitySimilarity: 0,
  instrumentalnessSimilarity: 0,
  voiceSimilarity: 0,
  instrumentsSimilarity: 0,
};

/** How much a boosted criterion's default weight is multiplied by when a
 * caller explicitly selects it (e.g. the "Boost similarity by" UI), before
 * the BOOSTED_WEIGHT_CEILING clamp below. */
const BOOST_MULTIPLIER = 2.5;

/**
 * Upper bound on the summed weight contributed by the SELECTED criteria
 * alone (unselected criteria stay untouched at their default). Combined with
 * the ~0.14 the unselected default criteria always contribute, this keeps
 * the total comfortably under the embedding base's fixed weight of 1.0 --
 * see recommendation-query.builder.ts -- even when every boost is selected
 * at once, instead of scaling unboundedly with how many are selected.
 */
const BOOSTED_WEIGHT_CEILING = 0.7;

/**
 * Applies BOOST_MULTIPLIER to each selected criterion's default weight, then
 * -- only if the selected criteria's combined weight would exceed
 * BOOSTED_WEIGHT_CEILING -- proportionally scales just those selected
 * weights back down (preserving their relative ratios). Weights for
 * criteria NOT selected are always left at their plain default, so boosting
 * one criterion never perturbs another. Unknown keys are ignored rather than
 * throwing, since this is fed directly from a caller-supplied string list
 * (GraphQL arg).
 */
export function applyRecommendationBoosts(
  boostKeys: readonly string[] | undefined,
): RecommendationWeights {
  if (!boostKeys || boostKeys.length === 0) {
    return DEFAULT_RECOMMENDATION_WEIGHTS;
  }
  const selected = new Set(
    boostKeys.filter((key): key is RecommendationBoostKey =>
      (ACTIVE_RECOMMENDATION_BOOST_KEYS as readonly string[]).includes(key),
    ),
  );
  if (selected.size === 0) {
    return DEFAULT_RECOMMENDATION_WEIGHTS;
  }
  const weights = { ...DEFAULT_RECOMMENDATION_WEIGHTS };
  for (const key of selected) {
    weights[key] = weights[key] * BOOST_MULTIPLIER;
  }
  const boostedTotal = [...selected].reduce((sum, key) => sum + weights[key], 0);
  if (boostedTotal > BOOSTED_WEIGHT_CEILING) {
    const scale = BOOSTED_WEIGHT_CEILING / boostedTotal;
    for (const key of selected) {
      weights[key] = weights[key] * scale;
    }
  }
  return weights;
}
