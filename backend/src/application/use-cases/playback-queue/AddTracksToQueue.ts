import { MusicTrackId } from 'src/kernel/ids';
import { createNotFoundError } from 'src/kernel/types/errors';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IQueueRepository, QueueItemWithTrack } from '../../ports/repositories/IQueueRepository';

export class AddTracksToQueueUseCase {
  constructor(
    private readonly queueRepository: IQueueRepository,

    private readonly musicTrackRepository: IMusicTrackRepository,
  ) {}

  async execute(trackIds: MusicTrackId[]): Promise<QueueItemWithTrack[]> {
    if (trackIds.length === 0) return this.queueRepository.getQueue();

    for (const trackId of trackIds) {
      const exists = await this.musicTrackRepository.verifyExistence(trackId);
      if (!exists) {
        throw createNotFoundError(`Track with ID ${trackId} not found`);
      }
    }

    const toAdd: MusicTrackId[] = [];
    for (const trackId of trackIds) {
      const existing = await this.queueRepository.findByTrackId(trackId);
      if (!existing) {
        toAdd.push(trackId);
      }
    }

    return this.queueRepository.addTracks(toAdd);
  }
}
