import { createNotFoundError } from 'src/clean-arch/kernel/types/errors';
import {
  IQueueRepository,
  QueueItemWithTrack,
  UpdateQueuePositionInput,
} from '../../ports/repositories/IQueueRepository';

export class UpdateQueuePositionsUseCase {
  constructor(private readonly queueRepository: IQueueRepository) {}

  async execute(
    positions: UpdateQueuePositionInput[],
  ): Promise<QueueItemWithTrack[]> {
    const trackIds = positions.map((p) => p.trackId);
    const existingItems = await Promise.all(
      trackIds.map((trackId) => this.queueRepository.findByTrackId(trackId)),
    );
    const missingCount = existingItems.filter((item) => item === null).length;
    if (missingCount > 0) {
      const missingTrackIds = trackIds.filter(
        (_, i) => existingItems[i] === null,
      );
      throw createNotFoundError(
        `Tracks not found in queue: ${missingTrackIds.join(', ')}`,
      );
    }
    return this.queueRepository.updatePositions(positions);
  }
}
