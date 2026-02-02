import { Inject, Injectable } from '@nestjs/common';
import {
  IQueueRepository,
  QUEUE_REPOSITORY,
  QueueItemWithTrack,
} from '../../ports/repositories/IQueueRepository';

@Injectable()
export class GetQueueUseCase {
  constructor(
    @Inject(QUEUE_REPOSITORY)
    private readonly queueRepository: IQueueRepository,
  ) {}

  async execute(): Promise<QueueItemWithTrack[]> {
    return this.queueRepository.getQueue();
  }
}
