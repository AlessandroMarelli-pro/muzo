import { Inject, Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { createNotFoundError } from 'src/clean-arch/kernel/types/errors';
import {
  IQueueRepository,
  QUEUE_REPOSITORY,
  RemoveTrackFromQueueResult,
} from '../../ports/repositories/IQueueRepository';

@Injectable()
export class RemoveTrackFromQueueUseCase {
  constructor(
    @Inject(QUEUE_REPOSITORY)
    private readonly queueRepository: IQueueRepository,
  ) {}

  async execute(trackId: MusicTrackId): Promise<RemoveTrackFromQueueResult> {
    const existing = await this.queueRepository.findByTrackId(trackId);
    if (!existing) {
      throw createNotFoundError('Track not found in queue');
    }
    return this.queueRepository.removeTrack(trackId);
  }
}
