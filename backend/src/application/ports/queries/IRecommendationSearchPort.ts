import { RecommendationCriteria } from 'src/kernel/types';
import { createToken } from '../../utils/create-token';
import { AudioFeatures } from '../dtos/AudioFeatures';
import { RecommendationMatch } from '../dtos/RecommendationMatch';

export const RECOMMENDATION_SEARCH_PORT =
  createToken<IRecommendationSearchPort>('RECOMMENDATION_SEARCH_PORT');

export interface IRecommendationSearchPort {
  searchByFeatures(
    features: AudioFeatures[],
    criteria: RecommendationCriteria,
  ): Promise<RecommendationMatch[]>;
}
