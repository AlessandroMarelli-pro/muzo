import { Injectable } from '@nestjs/common';
import { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { IRecommendationDataPort } from 'src/application/ports/queries/IRecommendationDataPort';
import { MusicTrack } from 'src/kernel/types';
import { calculateFeatures } from './calculate-features';

@Injectable()
export class RecommendationDataAdapter implements IRecommendationDataPort {
  constructor() {}

  getAudioFeatures(tracks: MusicTrack[]): AudioFeatures {
    return calculateFeatures(tracks);
  }
}
