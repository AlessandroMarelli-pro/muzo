import { Args, Field, ID, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { mapToSimpleMusicTrack } from '../music-track/music-track.resolver';
import { QueueItem, UpdateQueuePositionsInput } from './playback-queue.model';
import { PlaybackQueueService } from './playback-queue.service';

@ObjectType()
export class RemoveTrackFromQueueResponse {
  @Field(() => Boolean)
  success: boolean;
  @Field(() => ID)
  trackId: string;
  @Field(() => String)
  artist: string;
  @Field(() => String)
  title: string;
}
@Resolver('PlaybackQueue')
export class PlaybackQueueResolver {
  constructor(private readonly playbackQueueService: PlaybackQueueService) { }

  @Query(() => [QueueItem])
  async queue() {
    const queueItems = await this.playbackQueueService.getQueue();
    return queueItems.map((item) => ({
      id: item.id,
      trackId: item.trackId,
      position: item.position,
      track: item.track ? mapToSimpleMusicTrack(item.track) : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  @Mutation(() => QueueItem)
  async addTrackToQueue(@Args('trackId', { type: () => ID }) trackId: string) {
    const queueItem = await this.playbackQueueService.addTrackToQueue(trackId);
    return {
      id: queueItem.id,
      trackId: queueItem.trackId,
      position: queueItem.position,
      track: queueItem.track ? mapToSimpleMusicTrack(queueItem.track) : null,
      createdAt: queueItem.createdAt,
      updatedAt: queueItem.updatedAt,
    };
  }

  @Mutation(() => RemoveTrackFromQueueResponse)
  async removeTrackFromQueue(
    @Args('trackId', { type: () => ID }) trackId: string,
  ) {
    return await this.playbackQueueService.removeTrackFromQueue(trackId);
  }

  @Mutation(() => [QueueItem])
  async updateQueuePositions(@Args('input') input: UpdateQueuePositionsInput) {
    const queueItems = await this.playbackQueueService.updateQueuePositions(
      input.positions,
    );
    return queueItems.map((item) => ({
      id: item.id,
      trackId: item.trackId,
      position: item.position,
      track: item.track ? mapToSimpleMusicTrack(item.track) : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }
}
