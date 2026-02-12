import {
  IQueueRepository,
  QueueItemWithTrack,
} from '../../ports/repositories/IQueueRepository';

export class GetQueueUseCase {
  constructor(private readonly queueRepository: IQueueRepository) {}

  async execute(): Promise<QueueItemWithTrack[]> {
    return this.queueRepository.getQueue();
  }
}
