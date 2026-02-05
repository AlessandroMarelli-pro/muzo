import { Injectable } from '@nestjs/common';
import { AudioFeatures } from 'src/clean-arch/application/ports/dtos/AudioFeatures';
import { IRecommendationDataPort } from 'src/clean-arch/application/ports/queries/IRecommendationDataPort';
import { MusicTrack } from 'src/clean-arch/kernel/types';
import { calculateFeatures } from './calculate-features';

@Injectable()
export class RecommendationDataAdapter implements IRecommendationDataPort {
  constructor() {}

  getAudioFeatures(tracks: MusicTrack[]): AudioFeatures {
    return calculateFeatures(tracks);
  }
}
