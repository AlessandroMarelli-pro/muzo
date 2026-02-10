import { Injectable } from '@nestjs/common';
import {
  IQueueRepository,
  QueueItemWithTrack,
  RemoveTrackFromQueueResult,
  UpdateQueuePositionInput,
} from 'src/application/ports/repositories/IQueueRepository';
import { MusicTrackId } from 'src/kernel/ids';
import { extractModelId } from 'src/kernel/ids/factory';
import { getCurrentUserId } from 'src/kernel/types/context';
import { QueueItem } from 'src/kernel/types/model-types';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { toDomain, toDomainWithTrack, toPrismaCreate } from './queue.mapper';

const queueTrackInclude = {
  track: {
    include: {
      audioFingerprint: true,
      trackGenres: { include: { genre: true } },
      trackSubgenres: { include: { subgenre: true } },
      imageSearches: true,
    },
  },
} as const;

@Injectable()
export class QueueRepository implements IQueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getQueue(): Promise<QueueItemWithTrack[]> {
    return this.prisma.queue
      .findMany({
        where: { createdById: getCurrentUserId() },
        orderBy: { position: 'asc' },
        include: queueTrackInclude,
      })
      .then((rows) => rows.map(toDomainWithTrack));
  }

  async addTrack(trackId: MusicTrackId): Promise<QueueItemWithTrack> {
    const trackIdDb = extractModelId(trackId).dbId;
    const lastPosition = await this.getLastPosition();
    const nextPosition = (lastPosition ?? 0) + 1;
    const row = await this.prisma.queue.create({
      data: toPrismaCreate(trackIdDb, nextPosition, getCurrentUserId()),
      include: queueTrackInclude,
    });
    return toDomainWithTrack(row);
  }

  async addTracks(trackIds: MusicTrackId[]): Promise<QueueItemWithTrack[]> {
    const results: QueueItemWithTrack[] = [];
    let nextPosition = ((await this.getLastPosition()) ?? 0) + 1;
    const userId = getCurrentUserId();
    for (const trackId of trackIds) {
      const trackIdDb = extractModelId(trackId).dbId;
      const row = await this.prisma.queue.create({
        data: toPrismaCreate(trackIdDb, nextPosition, userId),
        include: queueTrackInclude,
      });
      results.push(toDomainWithTrack(row));
      nextPosition += 1;
    }
    return results;
  }

  async removeTrack(
    trackId: MusicTrackId,
  ): Promise<RemoveTrackFromQueueResult> {
    const trackIdDb = extractModelId(trackId).dbId;
    const queueItem = await this.prisma.queue.delete({
      where: { trackId: trackIdDb, createdById: getCurrentUserId() },
      include: queueTrackInclude,
    });
    await this.reorderPositionsAfterRemoval(queueItem.position);
    return {
      success: true,
      trackId,
      artist: queueItem.track?.originalArtist ?? null,
      title: queueItem.track?.originalTitle ?? null,
    };
  }

  async updatePositions(
    positions: UpdateQueuePositionInput[],
  ): Promise<QueueItemWithTrack[]> {
    for (const { trackId, position } of positions) {
      const trackIdDb = extractModelId(trackId).dbId;
      await this.prisma.queue.update({
        where: { trackId: trackIdDb, createdById: getCurrentUserId() },
        data: { position },
      });
    }
    return this.getQueue();
  }

  async findByTrackId(trackId: MusicTrackId): Promise<QueueItem | null> {
    const trackIdDb = extractModelId(trackId).dbId;
    return this.prisma.queue
      .findUnique({
        where: { trackId: trackIdDb, createdById: getCurrentUserId() },
      })
      .then((row) => (row ? toDomain(row) : null));
  }

  async getLastPosition(): Promise<number | null> {
    return this.prisma.queue
      .findFirst({
        where: { createdById: getCurrentUserId() },
        orderBy: { position: 'desc' },
        select: { position: true },
      })
      .then((row) => row?.position ?? null);
  }

  async resetQueue(): Promise<boolean> {
    return this.prisma.queue
      .deleteMany({
        where: { createdById: getCurrentUserId() },
      })
      .then((result) => result.count > 0);
  }

  private async reorderPositionsAfterRemoval(
    removedPosition: number,
  ): Promise<boolean> {
    return this.prisma.queue
      .updateMany({
        where: {
          createdById: getCurrentUserId(),
          position: { gt: removedPosition },
        },
        data: { position: { decrement: 1 } },
      })
      .then(() => true);
  }
}
