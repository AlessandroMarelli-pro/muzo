import { MusicTrack } from 'src/clean-arch/kernel/types';
import { AudioFeatures } from '../dtos/AudioFeatures';
export const RECOMMENDATION_DATA_PORT = Symbol('IRecommendationDataPort');

export interface IRecommendationDataPort {
  getAudioFeatures(tracks: MusicTrack[]): AudioFeatures;
}
