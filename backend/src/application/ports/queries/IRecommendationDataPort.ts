import { Maybe, MusicTrack } from 'src/kernel/types';
import { createToken } from '../../utils/create-token';
import { AudioFeatures } from '../dtos/AudioFeatures';

export const RECOMMENDATION_DATA_PORT = createToken<IRecommendationDataPort>(
  'RECOMMENDATION_DATA_PORT',
);

export interface IRecommendationDataPort {
  getAudioFeatures(tracks: MusicTrack[]): Maybe<AudioFeatures>;
}
