import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  AddTrackToQueueUseCase,
  AddTracksToQueueUseCase,
  RemoveTrackFromQueueUseCase,
  ResetQueueUseCase,
  UpdateQueuePositionsUseCase,
} from 'src/application/use-cases';
import { AuthGuard } from '../context/auth.guard';

import { parseMusicTrackId } from '../../common/utils/parse-id';
import { toTrack } from '../mappers/track.mapper';
import { Base64ID } from '../scalars/base64-id.scalar';
import {
  QueueItem,
  RemoveTrackFromQueueResponse,
} from '../schema/queue-item.schema';
import { UpdateQueuePositionsInput } from '../schema/queue.input';

@Resolver(() => QueueItem)
@UseGuards(AuthGuard)
export class PlaybackQueueResolver {
  constructor(
    private readonly addTrackToQueueUseCase: AddTrackToQueueUseCase,
    private readonly addTracksToQueueUseCase: AddTracksToQueueUseCase,
    private readonly removeTrackFromQueueUseCase: RemoveTrackFromQueueUseCase,
    private readonly resetQueueUseCase: ResetQueueUseCase,
    private readonly updateQueuePositionsUseCase: UpdateQueuePositionsUseCase,
  ) {}

  @Mutation(() => QueueItem)
  async addTrackToQueue(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<QueueItem> {
    const item = await this.addTrackToQueueUseCase.execute(
      parseMusicTrackId(trackId),
    );
    return {
      id: item.id,
      trackId: item.trackId,
      position: item.position,
      track: item.track ? toTrack(item.track) : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  @Mutation(() => [QueueItem])
  async addTracksToQueue(
    @Args('trackIds', { type: () => [Base64ID] }) trackIds: string[],
  ): Promise<QueueItem[]> {
    const items = await this.addTracksToQueueUseCase.execute(
      trackIds.map(parseMusicTrackId),
    );
    return items.map((item) => ({
      id: item.id,
      trackId: item.trackId,
      position: item.position,
      track: item.track ? toTrack(item.track) : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  @Mutation(() => RemoveTrackFromQueueResponse)
  async removeTrackFromQueue(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<RemoveTrackFromQueueResponse> {
    return this.removeTrackFromQueueUseCase.execute(parseMusicTrackId(trackId));
  }

  @Mutation(() => Boolean)
  async resetQueue(): Promise<boolean> {
    return this.resetQueueUseCase.execute();
  }

  @Mutation(() => [QueueItem])
  async updateQueuePositions(
    @Args('input') input: UpdateQueuePositionsInput,
  ): Promise<QueueItem[]> {
    const items = await this.updateQueuePositionsUseCase.execute(
      input.positions.map((p) => ({
        trackId: parseMusicTrackId(p.trackId),
        position: p.position,
      })),
    );
    return items.map((item) => ({
      id: item.id,
      trackId: item.trackId,
      position: item.position,
      track: item.track ? toTrack(item.track) : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }
}
