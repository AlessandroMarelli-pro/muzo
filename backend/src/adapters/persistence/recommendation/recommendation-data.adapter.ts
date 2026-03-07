import { Injectable } from '@nestjs/common';
import { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { IRecommendationDataPort } from 'src/application/ports/queries/IRecommendationDataPort';
import { Maybe, MusicTrack } from 'src/kernel/types';
import { calculateFeatures } from './calculate-features';

@Injectable()
export class RecommendationDataAdapter implements IRecommendationDataPort {
  getAudioFeatures(tracks: MusicTrack[]): Maybe<AudioFeatures> {
    return calculateFeatures(tracks);
  }
}
