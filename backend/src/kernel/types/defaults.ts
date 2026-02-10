import type {
  ActionContext,
  RecommendationWeights,
} from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';

export function getAnonymousUser(): ActionContext['user'] {
  return {
    id: models.user.id('anonymous'),
    createdAt: new Date(0),
    createdById: models.user.id('anonymous'),
    updatedAt: new Date(0),
    updatedById: null,
    email: 'anonymous@example.com' as ActionContext['user']['email'],
    firstName: 'anonymous',
    lastName: 'anonymous',
  } as ActionContext['user'];
}

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  audioSimilarity: 0.3,
  genreSimilarity: 1.0,
  metadataSimilarity: 0.2,
  userBehavior: 0.1,
  audioFeatures: 2.0,
  aiMetadataSimilarity: 0.7,
};

export const ZERO_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  audioSimilarity: 0,
  genreSimilarity: 0,
  metadataSimilarity: 0,
  userBehavior: 0,
  audioFeatures: 0,
  aiMetadataSimilarity: 0,
};
