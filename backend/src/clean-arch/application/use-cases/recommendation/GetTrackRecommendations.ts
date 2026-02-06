import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { TrackSimilarity } from 'src/clean-arch/kernel/types';
import { DEFAULT_RECOMMENDATION_WEIGHTS } from 'src/clean-arch/kernel/types/defaults';
import { IRecommendationDataPort } from '../../ports/queries/IRecommendationDataPort';
import { IRecommendationSearchPort } from '../../ports/queries/IRecommendationSearchPort';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class GetTrackRecommendationsUseCase {
  constructor(
    private readonly recommendationSearchPort: IRecommendationSearchPort,

    private readonly musicTrackRepository: IMusicTrackRepository,

    private readonly recommendationDataPort: IRecommendationDataPort,
  ) {}

  async execute(
    trackId: MusicTrackId,
    limit: number = 20,
  ): Promise<TrackSimilarity[]> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    const features = this.recommendationDataPort.getAudioFeatures([track]);

    const recommendations =
      await this.recommendationSearchPort.searchByFeatures([features], {
        weights: DEFAULT_RECOMMENDATION_WEIGHTS,
        limit,
        excludeTrackIds: [trackId],
      });
    const findTracks = await this.musicTrackRepository.getManyByIds(
      recommendations.map((recommendation) => recommendation.track.id),
    );
    return recommendations.map((recommendation) => ({
      track: findTracks.find((track) => track.id === recommendation.track.id),
      similarity: recommendation.similarity,
      reasons: recommendation.reasons,
    }));
  }
}
