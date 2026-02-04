import { MusicTrack } from 'src/clean-arch/kernel/types';
import { AudioFeatures } from '../dtos/AudioFeatures';
import { TrackIndexDocument } from '../dtos/TrackIndexDocument';
export const RECOMMENDATION_DATA_PORT = Symbol('IRecommendationDataPort');

export interface IRecommendationDataPort {
  getTrackIndexDocument(track: MusicTrack): TrackIndexDocument;
  getAudioFeatures(tracks: MusicTrack[]): AudioFeatures;
}
