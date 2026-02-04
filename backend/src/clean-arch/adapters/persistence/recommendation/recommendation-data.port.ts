import { Injectable } from '@nestjs/common';
import { AudioFeatures } from 'src/clean-arch/application/ports/dtos/AudioFeatures';
import { TrackIndexDocument } from 'src/clean-arch/application/ports/dtos/TrackIndexDocument';
import { IRecommendationDataPort } from 'src/clean-arch/application/ports/queries/IRecommendationDataPort';
import { MusicTrack } from 'src/clean-arch/kernel/types';
import { calculateFeatures } from './calculate-features';
import { toTrackIndexDocument } from './recommendation.mapper';

@Injectable()
export class RecommendationDataPort implements IRecommendationDataPort {
  constructor() {}
  getTrackIndexDocument(track: MusicTrack): TrackIndexDocument {
    return toTrackIndexDocument(track);
  }
  getAudioFeatures(tracks: MusicTrack[]): AudioFeatures {
    return calculateFeatures(tracks);
  }
}
