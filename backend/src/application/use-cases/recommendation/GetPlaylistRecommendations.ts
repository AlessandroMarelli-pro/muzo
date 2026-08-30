import { PlaylistId } from 'src/kernel/ids';
import { TrackSimilarity } from 'src/kernel/types';
import { DEFAULT_RECOMMENDATION_WEIGHTS } from 'src/kernel/types/defaults';
import { IRecommendationDataPort } from '../../ports/queries/IRecommendationDataPort';
import { IRecommendationSearchPort } from '../../ports/queries/IRecommendationSearchPort';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';

export class GetPlaylistRecommendationsUseCase {
  constructor(
    private readonly recommendationSearchPort: IRecommendationSearchPort,

    private readonly playlistTrackRepository: IPlaylistTrackRepository,

    private readonly recommendationDataPort: IRecommendationDataPort,

    private readonly musicTrackRepository: IMusicTrackRepository,
  ) {}

  async execute(playlistId: PlaylistId, limit: number = 50): Promise<TrackSimilarity[]> {
    const playlistTracks = await this.playlistTrackRepository.getTracksByPlaylistIdWithTrack(
      playlistId,
      {
        sortingKey: 'addedAt',
        sortingDirection: 'asc',
      },
    );

    const features = this.recommendationDataPort.getAudioFeatures(
      playlistTracks.map((track) => track.track),
    );
    if (!features) {
      return [];
    }
    console.log(features);
    const recommendations = await this.recommendationSearchPort.searchByFeatures([features], {
      weights: DEFAULT_RECOMMENDATION_WEIGHTS,
      limit,
      excludeTrackIds: playlistTracks.map((track) => track.track.id),
    });
    const findTracks = await this.musicTrackRepository.getManyByIds(
      recommendations.map((recommendation) => recommendation.track?.id),
    );
    return recommendations.map((recommendation) => ({
      track: findTracks.find((track) => track.id === recommendation.track.id)!,
      similarity: recommendation.similarity,
      reasons: recommendation.reasons,
    }));
  }
}
