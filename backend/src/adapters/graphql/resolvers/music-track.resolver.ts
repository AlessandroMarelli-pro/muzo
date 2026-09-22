import { Inject, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
  GetTrackRecommendationsUseCase,
  ScheduleSingleTrackScanUseCase,
} from 'src/application/use-cases';
import { RecommendationSeedStrategy } from 'src/kernel/types';
import {
  BANDCAMP_RESOLVE_PRODUCER,
  IBandcampResolveProducer,
} from 'src/application/ports/infrastructure/IBandcampResolveProducer';
import {
  DISCOGS_RESOLVE_PRODUCER,
  IDiscogsResolveProducer,
} from 'src/application/ports/infrastructure/IDiscogsResolveProducer';
import {
  HQ_AUDIO_ACQUIRE_PRODUCER,
  IHqAudioAcquireProducer,
} from 'src/application/ports/infrastructure/IHqAudioAcquireProducer';
import {
  HQ_AUDIO_ENHANCE_PRODUCER,
  IHqAudioEnhanceProducer,
} from 'src/application/ports/infrastructure/IHqAudioEnhanceProducer';
import {
  DeleteHqAudioUseCase,
  ToggleBangerUseCase,
  ToggleDislikeUseCase,
  ToggleFavoriteUseCase,
  ToggleLikeUseCase,
  UpdateTrackMetadataUseCase,
} from 'src/application/use-cases/music-track';
import { RestoreHiddenTrackUseCase } from 'src/application/use-cases/hidden-music-track';
import { SessionId } from 'src/kernel/ids';
import { getCurrentUser } from 'src/kernel/types/context';
import { parseHiddenMusicTrackId, parseMusicTrackId } from '../../common/utils/parse-id';
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
    private readonly scheduleSingleTrackScanUseCase: ScheduleSingleTrackScanUseCase,
    private readonly toggleFavoriteUseCase: ToggleFavoriteUseCase,
    private readonly toggleLikeUseCase: ToggleLikeUseCase,
    private readonly toggleDislikeUseCase: ToggleDislikeUseCase,
    private readonly restoreHiddenTrackUseCase: RestoreHiddenTrackUseCase,
    private readonly toggleBangerUseCase: ToggleBangerUseCase,
    private readonly updateTrackMetadataUseCase: UpdateTrackMetadataUseCase,
    private readonly deleteHqAudioUseCase: DeleteHqAudioUseCase,
    @Inject(HQ_AUDIO_ACQUIRE_PRODUCER)
    private readonly hqAudioAcquireProducer: IHqAudioAcquireProducer,
    @Inject(HQ_AUDIO_ENHANCE_PRODUCER)
    private readonly hqAudioEnhanceProducer: IHqAudioEnhanceProducer,
    @Inject(BANDCAMP_RESOLVE_PRODUCER)
    private readonly bandcampResolveProducer: IBandcampResolveProducer,
    @Inject(DISCOGS_RESOLVE_PRODUCER)
    private readonly discogsResolveProducer: IDiscogsResolveProducer,
  ) {}

  @ResolveField(() => [TrackRecommendation])
  async recommendations(
    @Parent() parent: Track,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('seedStrategy', { type: () => String, nullable: true })
    seedStrategy?: RecommendationSeedStrategy,
    @Args('boosts', { type: () => [String], nullable: true }) boosts?: string[],
  ) {
    return this.getTrackRecommendationsUseCase
      .execute(parent.id, limit, seedStrategy, boosts)
      .then((recommendations) =>
        recommendations.map((recommendation) => ({
          track: toTrack(recommendation.track),
          similarity: recommendation.similarity,
          reasons: recommendation.reasons,
        })),
      );
  }

  @Mutation(() => Track)
  async toggleFavorite(@Args('trackId', { type: () => Base64ID }) trackId: string): Promise<Track> {
    return this.toggleFavoriteUseCase.execute(parseMusicTrackId(trackId)).then(toTrack);
  }
  @Mutation(() => Track)
  async toggleLike(@Args('trackId', { type: () => Base64ID }) trackId: string): Promise<Track> {
    return this.toggleLikeUseCase.execute(parseMusicTrackId(trackId)).then(toTrack);
  }
  @Mutation(() => Boolean)
  async toggleDislike(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<boolean> {
    return this.toggleDislikeUseCase.execute(parseMusicTrackId(trackId));
  }

  @Mutation(() => Track)
  async restoreHiddenTrack(
    @Args('hiddenTrackId', { type: () => Base64ID }) hiddenTrackId: string,
  ): Promise<Track> {
    return this.restoreHiddenTrackUseCase
      .execute(parseHiddenMusicTrackId(hiddenTrackId))
      .then(toTrack);
  }

  @Mutation(() => Track)
  async toggleBanger(@Args('trackId', { type: () => Base64ID }) trackId: string): Promise<Track> {
    return this.toggleBangerUseCase.execute(parseMusicTrackId(trackId)).then(toTrack);
  }

  @Mutation(() => Track)
  async updateTrackMetadata(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
    @Args('artist') artist: string,
    @Args('title') title: string,
  ): Promise<Track> {
    return this.updateTrackMetadataUseCase
      .execute(parseMusicTrackId(trackId), artist, title)
      .then(toTrack);
  }

  @Mutation(() => Base64ID)
  async scanTrack(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
    @Args('force', { type: () => Boolean, nullable: true }) force?: boolean,
  ): Promise<SessionId> {
    return this.scheduleSingleTrackScanUseCase
      .execute(parseMusicTrackId(trackId), force ?? false)
      .then(({ sessionId }) => sessionId);
  }

  @Mutation(() => Boolean)
  async downloadHqAudio(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<boolean> {
    await this.hqAudioAcquireProducer.scheduleHqAudioAcquire(
      parseMusicTrackId(trackId),
      getCurrentUser(),
    );
    return true;
  }

  @Mutation(() => Boolean)
  async enhanceHqAudio(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<boolean> {
    await this.hqAudioEnhanceProducer.scheduleHqAudioEnhance(
      parseMusicTrackId(trackId),
      getCurrentUser(),
    );
    return true;
  }

  @Mutation(() => Boolean)
  async lookupBandcampUrl(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<boolean> {
    await this.bandcampResolveProducer.scheduleBandcampResolve(
      parseMusicTrackId(trackId),
      getCurrentUser(),
    );
    return true;
  }

  @Mutation(() => Boolean)
  async lookupDiscogsUrl(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<boolean> {
    await this.discogsResolveProducer.scheduleDiscogsResolve(
      parseMusicTrackId(trackId),
      getCurrentUser(),
    );
    return true;
  }

  @Mutation(() => Boolean)
  async deleteHqAudio(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<boolean> {
    return this.deleteHqAudioUseCase.execute(parseMusicTrackId(trackId));
  }
}
