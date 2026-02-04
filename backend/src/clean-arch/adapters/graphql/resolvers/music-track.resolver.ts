import { Args, Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { GetTrackRecommendationsUseCase } from 'src/clean-arch/application/use-cases';
import { toTrack } from '../mappers/track.mapper';
import { TrackRecommendation } from '../schema/recommendation.schema';
import { Track } from '../schema/track.schema';

@Resolver(() => Track)
export class MusicTrackResolver {
  constructor(
    private readonly getTrackRecommendationsUseCase: GetTrackRecommendationsUseCase,
  ) {}

  @ResolveField(() => [TrackRecommendation])
  async recommendations(
    @Parent() parent: Track,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.getTrackRecommendationsUseCase
      .execute(parent.id, limit)
      .then((recommendations) =>
        recommendations.map((recommendation) => ({
          track: toTrack(recommendation.track),
          similarity: recommendation.similarity,
          reasons: recommendation.reasons,
        })),
      );
  }
}
