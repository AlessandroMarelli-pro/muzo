import { RecommendationCriteria } from 'src/clean-arch/kernel/types';
import { AudioFeatures } from '../dtos/AudioFeatures';
import { RecommendationMatch } from '../dtos/RecommendationMatch';

export const RECOMMENDATION_SEARCH_PORT = Symbol('IRecommendationSearchPort');

export interface IRecommendationSearchPort {
  searchByFeatures(
    features: AudioFeatures[],
    criteria: RecommendationCriteria,
  ): Promise<RecommendationMatch[]>;
}
