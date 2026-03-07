import { MusicTrackId } from 'src/kernel/ids';
import { createConflictError } from 'src/kernel/types/errors';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IQueueRepository, QueueItemWithTrack } from '../../ports/repositories/IQueueRepository';

export class AddTrackToQueueUseCase {
  constructor(
    private readonly queueRepository: IQueueRepository,

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
