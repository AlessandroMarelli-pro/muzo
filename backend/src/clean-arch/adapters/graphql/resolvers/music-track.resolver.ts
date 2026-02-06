import { UseGuards } from '@nestjs/common';
import {
  Args,
  Int,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { GetTrackRecommendationsUseCase } from 'src/clean-arch/application/use-cases';
import {
  ToggleBangerUseCase,
  ToggleDislikeUseCase,
  ToggleFavoriteUseCase,
  ToggleLikeUseCase,
} from 'src/clean-arch/application/use-cases/music-track/';
import { parseMusicTrackId } from '../../common/utils/parse-id';
import { AuthGuard } from '../context/auth.guard';
import { toTrack } from '../mappers/track.mapper';
import { Base64ID } from '../scalars/base64-id.scalar';
import { TrackRecommendation } from '../schema/recommendation.schema';
import { Track } from '../schema/track.schema';

@Resolver(() => Track)
@UseGuards(AuthGuard)
export class MusicTrackResolver {
  constructor(
    private readonly getTrackRecommendationsUseCase: GetTrackRecommendationsUseCase,
    private readonly toggleFavoriteUseCase: ToggleFavoriteUseCase,
    private readonly toggleLikeUseCase: ToggleLikeUseCase,
    private readonly toggleDislikeUseCase: ToggleDislikeUseCase,
    private readonly toggleBangerUseCase: ToggleBangerUseCase,
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

  @Mutation(() => Track)
  async toggleFavorite(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<Track> {
    return this.toggleFavoriteUseCase
      .execute(parseMusicTrackId(trackId))
      .then(toTrack);
  }
  @Mutation(() => Track)
  async toggleLike(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<Track> {
    return this.toggleLikeUseCase
      .execute(parseMusicTrackId(trackId))
      .then(toTrack);
  }
  @Mutation(() => Boolean)
  async toggleDislike(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<boolean> {
    return this.toggleDislikeUseCase.execute(parseMusicTrackId(trackId));
  }

  @Mutation(() => Track)
  async toggleBanger(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<Track> {
    return this.toggleBangerUseCase
      .execute(parseMusicTrackId(trackId))
      .then(toTrack);
  }
}
