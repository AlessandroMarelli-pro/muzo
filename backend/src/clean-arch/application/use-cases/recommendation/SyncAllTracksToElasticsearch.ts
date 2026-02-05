import { Injectable } from '@nestjs/common';
import { IRecommendationDataPort } from '../../ports/queries/IRecommendationDataPort';
import { ITrackIndexerPort } from '../../ports/queries/ITrackIndexerPort';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class SyncAllTracksToElasticsearchUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,

    private readonly trackIndexerPort: ITrackIndexerPort,

    private readonly recommendationDataPort: IRecommendationDataPort,
  ) {}

  async execute(): Promise<void> {
    await this.trackIndexerPort.recreateIndex();
    const tracks = await this.musicTrackRepository.getAll();
    await this.trackIndexerPort.deleteTracks(tracks.map((track) => track.id));
    return this.trackIndexerPort.indexTracks(tracks);
  }
}
