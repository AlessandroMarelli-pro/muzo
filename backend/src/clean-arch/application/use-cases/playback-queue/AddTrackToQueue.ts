import { Inject, Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { createConflictError } from 'src/clean-arch/kernel/types/errors';
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
export class AddTrackToQueueUseCase {
  constructor(
    @Inject(QUEUE_REPOSITORY)
    private readonly queueRepository: IQueueRepository,
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,
  ) {}

  async execute(trackId: MusicTrackId): Promise<QueueItemWithTrack> {
    await this.musicTrackRepository.verifyExistence(trackId);

    const existing = await this.queueRepository.findByTrackId(trackId);
    if (existing) {
      throw createConflictError('Track is already in the queue');
    }

    return this.queueRepository.addTrack(trackId);
  }
}
