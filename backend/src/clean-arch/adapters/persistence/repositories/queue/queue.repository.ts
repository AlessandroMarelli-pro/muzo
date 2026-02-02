import { Injectable } from '@nestjs/common';
import {
  IQueueRepository,
  QueueItemWithTrack,
  RemoveTrackFromQueueResult,
  UpdateQueuePositionInput,
} from 'src/clean-arch/application/ports/repositories/IQueueRepository';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { getCurrentUserId } from 'src/clean-arch/kernel/types/context';
import { createNotFoundError } from 'src/clean-arch/kernel/types/errors';
import { QueueItem } from 'src/clean-arch/kernel/types/model-types';
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
    if (trackIds.length === 0) return this.getQueue();
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
    const queueItem = await this.prisma.queue.findUnique({
      where: { trackId: trackIdDb, createdById: getCurrentUserId() },
    });
    if (!queueItem) {
      throw createNotFoundError('Track not found in queue');
    }
    const track = await this.prisma.musicTrack.findUnique({
      where: { id: trackIdDb },
      select: { originalArtist: true, originalTitle: true },
    });
    const removedPosition = queueItem.position;
    await this.prisma.queue.delete({
      where: { trackId: trackIdDb, createdById: getCurrentUserId() },
    });
    await this.reorderPositionsAfterRemoval(removedPosition);
    return {
      success: true,
      trackId,
      artist: track?.originalArtist ?? null,
      title: track?.originalTitle ?? null,
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
    const row = await this.prisma.queue.findUnique({
      where: { trackId: trackIdDb, createdById: getCurrentUserId() },
    });
    return row ? toDomain(row) : null;
  }

  async getLastPosition(): Promise<number | null> {
    const last = await this.prisma.queue.findFirst({
      where: { createdById: getCurrentUserId() },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return last?.position ?? null;
  }

  async resetQueue(): Promise<void> {
    await this.prisma.queue.deleteMany({
      where: { createdById: getCurrentUserId() },
    });
  }

  private async reorderPositionsAfterRemoval(
    removedPosition: number,
  ): Promise<void> {
    const items = await this.prisma.queue.findMany({
      where: {
        createdById: getCurrentUserId(),
        position: { gt: removedPosition },
      },
      orderBy: { position: 'asc' },
    });
    await Promise.all(
      items.map((item, index) =>
        this.prisma.queue.update({
          where: { id: item.id },
          data: { position: removedPosition + index },
        }),
      ),
    );
  }
}
