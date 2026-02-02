import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  AddTrackToQueueUseCase,
  AddTracksToQueueUseCase,
  RemoveTrackFromQueueUseCase,
  ResetQueueUseCase,
  UpdateQueuePositionsUseCase,
} from 'src/clean-arch/application/use-cases';
import { AuthGuard } from '../context/auth.guard';

import { toTrack } from '../mappers/track.mapper';
import { Base64ID } from '../scalars/base64-id.scalar';
import {
  CleanArchQueueItem,
  RemoveTrackFromQueueResponse,
} from '../schema/queue-item.schema';
import { UpdateQueuePositionsInput } from '../schema/queue.input';
import { parseMusicTrackId } from '../utils/parse-id';

@Resolver(() => CleanArchQueueItem)
@UseGuards(AuthGuard)
export class PlaybackQueueResolver {
  constructor(
    private readonly addTrackToQueueUseCase: AddTrackToQueueUseCase,
    private readonly addTracksToQueueUseCase: AddTracksToQueueUseCase,
    private readonly removeTrackFromQueueUseCase: RemoveTrackFromQueueUseCase,
    private readonly resetQueueUseCase: ResetQueueUseCase,
    private readonly updateQueuePositionsUseCase: UpdateQueuePositionsUseCase,
  ) {}

  @Mutation(() => CleanArchQueueItem)
  async addTrackToQueue(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<CleanArchQueueItem> {
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

  @Mutation(() => [CleanArchQueueItem])
  async addTracksToQueue(
    @Args('trackIds', { type: () => [Base64ID] }) trackIds: string[],
  ): Promise<CleanArchQueueItem[]> {
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
    await this.resetQueueUseCase.execute();
    return true;
  }

  @Mutation(() => [CleanArchQueueItem])
  async updateQueuePositions(
    @Args('input') input: UpdateQueuePositionsInput,
  ): Promise<CleanArchQueueItem[]> {
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
