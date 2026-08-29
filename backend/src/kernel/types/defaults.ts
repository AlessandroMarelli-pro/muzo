import type { ActionContext, RecommendationWeights } from 'src/kernel/types/model-types';
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

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  audioSimilarity: 0.3,
  genreSimilarity: 1.0,
  metadataSimilarity: 0.2,
  userBehavior: 0.1,
  audioFeatures: 2.0,
};

export const ZERO_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  audioSimilarity: 0,
  genreSimilarity: 0,
  metadataSimilarity: 0,
  userBehavior: 0,
  audioFeatures: 0,
};
