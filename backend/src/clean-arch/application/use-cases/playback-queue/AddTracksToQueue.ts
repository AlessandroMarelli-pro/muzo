import { Inject, Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { createNotFoundError } from 'src/clean-arch/kernel/types/errors';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';
import {
  IQueueRepository,
  QUEUE_REPOSITORY,
  QueueItemWithTrack,
} from '../../ports/repositories/IQueueRepository';

@Injectable()
export class AddTracksToQueueUseCase {
  constructor(
    @Inject(QUEUE_REPOSITORY)
    private readonly queueRepository: IQueueRepository,
    @Inject(MUSIC_TRACK_REPOSITORY)
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
