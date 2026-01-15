import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { mapToSimpleMusicTrack } from '../music-track/music-track.resolver';
import { QueueItem, UpdateQueuePositionsInput } from './playback-queue.model';
import { PlaybackQueueService } from './playback-queue.service';

@Resolver('PlaybackQueue')
export class PlaybackQueueResolver {
  constructor(private readonly playbackQueueService: PlaybackQueueService) {}

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

  @Mutation(() => Boolean)
  async removeTrackFromQueue(
    @Args('trackId', { type: () => ID }) trackId: string,
  ) {
    await this.playbackQueueService.removeTrackFromQueue(trackId);
    return true;
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
