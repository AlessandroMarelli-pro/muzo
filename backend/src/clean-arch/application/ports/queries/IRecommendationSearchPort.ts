import {
  RecommendationCriteria,
  TrackSimilarity,
} from 'src/clean-arch/kernel/types';
import { TrackIndexDocument } from '../dtos/TrackIndexDocument';

export const RECOMMENDATION_SEARCH_PORT = Symbol('IRecommendationSearchPort');

export interface IRecommendationSearchPort {
  searchByFeatures(
    features: TrackIndexDocument,
    criteria: RecommendationCriteria,
  ): Promise<TrackSimilarity[]>;
}
