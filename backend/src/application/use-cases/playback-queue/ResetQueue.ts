import { IQueueRepository } from '../../ports/repositories/IQueueRepository';

export class ResetQueueUseCase {
  constructor(private readonly queueRepository: IQueueRepository) {}

  async execute(): Promise<boolean> {
    return this.queueRepository.resetQueue();
  }
}
