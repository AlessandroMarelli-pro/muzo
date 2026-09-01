import { IRecommendationDataPort } from '../../ports/queries/IRecommendationDataPort';
import { ITrackIndexerPort } from '../../ports/queries/ITrackIndexerPort';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class SyncAllTracksToElasticsearchUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,

    private readonly trackIndexerPort: ITrackIndexerPort,

    private readonly recommendationDataPort: IRecommendationDataPort,
  ) {}

  async execute(): Promise<void> {
    // recreateIndex() already drops and recreates the index, so it starts
    // empty -- a bulk deleteTracks() here was a redundant no-op delete of
    // every track id against an index with nothing in it.
    await this.trackIndexerPort.recreateIndex();
    const tracks = await this.musicTrackRepository.getAll();
    return this.trackIndexerPort.indexTracks(tracks);
  }
}
