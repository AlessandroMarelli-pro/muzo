import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { simpleMusicTrackFieldSelectors } from 'src/shared/field-selectors/simple-music-track';
import { PrismaService } from '../../shared/services/prisma.service';

@Injectable()
export class PlaybackQueueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all queue items ordered by position
   */
  async getQueue() {
    const queueItems = await this.prisma.queue.findMany({
      orderBy: { position: 'asc' },
      select: {
        id: true,
        trackId: true,
        position: true,
        createdAt: true,
        updatedAt: true,
        track: { select: simpleMusicTrackFieldSelectors },
      },
    });

    return queueItems;
  }

  /**
   * Add a track to the queue
   * @param trackId - The ID of the track to add
   * @returns The created queue item
   */
  async addTrackToQueue(trackId: string) {
    // Check if track exists
    const track = await this.prisma.musicTrack.findUnique({
      where: { id: trackId },
    });

    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    // Check if track is already in queue
    const existingQueueItem = await this.prisma.queue.findUnique({
      where: { trackId },
    });

    if (existingQueueItem) {
      throw new BadRequestException('Track is already in the queue');
    }

    // Get the next position (highest position + 1)
    const lastItem = await this.prisma.queue.findFirst({
      orderBy: { position: 'desc' },
    });

    const nextPosition = (lastItem?.position ?? 0) + 1;

    // Create the queue item
    const queueItem = await this.prisma.queue.create({
      data: {
        trackId,
        position: nextPosition,
      },
      select: {
        id: true,
        trackId: true,
        position: true,
        createdAt: true,
        updatedAt: true,
        track: { select: simpleMusicTrackFieldSelectors },
      },
    });

    return queueItem;
  }

  /**
   * Remove a track from the queue by trackId
   * Automatically updates all positions after removal
   * @param trackId - The ID of the track to remove
   */
  async removeTrackFromQueue(trackId: string) {
    // Find the queue item
    const queueItem = await this.prisma.queue.findUnique({
      where: { trackId },
    });

    if (!queueItem) {
      throw new NotFoundException('Track not found in queue');
    }

    const removedPosition = queueItem.position;

    // Delete the queue item
    await this.prisma.queue.delete({
      where: { trackId },
    });

    // Reorder remaining tracks to fill the gap
    await this.reorderPositionsAfterRemoval(removedPosition);

    return { success: true };
  }

  /**
   * Update queue positions
   * @param positions - Array of trackId and position pairs
   */
  async updateQueuePositions(
    positions: Array<{ trackId: string; position: number }>,
  ) {
    // Validate all tracks exist in queue
    const trackIds = positions.map((p) => p.trackId);
    const existingItems = await this.prisma.queue.findMany({
      where: { trackId: { in: trackIds } },
    });

    if (existingItems.length !== trackIds.length) {
      const existingTrackIds = existingItems.map((item) => item.trackId);
      const missingTrackIds = trackIds.filter(
        (id) => !existingTrackIds.includes(id),
      );
      throw new NotFoundException(
        `Tracks not found in queue: ${missingTrackIds.join(', ')}`,
      );
    }

    // Update positions
    const updatePromises = positions.map(({ trackId, position }) =>
      this.prisma.queue.update({
        where: { trackId },
        data: { position },
      }),
    );

    await Promise.all(updatePromises);

    // Return updated queue
    return this.getQueue();
  }

  /**
   * Reorder positions after a track is removed
   * Shifts all positions greater than removedPosition down by 1
   * @param removedPosition - The position that was removed
   */
  private async reorderPositionsAfterRemoval(removedPosition: number) {
    // Get all items with position greater than the removed position
    const itemsToReorder = await this.prisma.queue.findMany({
      where: {
        position: { gt: removedPosition },
      },
      orderBy: { position: 'asc' },
    });

    // Update positions to fill the gap
    const updatePromises = itemsToReorder.map((item, index) =>
      this.prisma.queue.update({
        where: { id: item.id },
        data: { position: removedPosition + index },
      }),
    );

    await Promise.all(updatePromises);
  }
}
