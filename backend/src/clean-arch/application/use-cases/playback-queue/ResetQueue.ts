import { Injectable } from '@nestjs/common';
import { IQueueRepository } from '../../ports/repositories/IQueueRepository';

@Injectable()
export class ResetQueueUseCase {
  constructor(private readonly queueRepository: IQueueRepository) {}

  async execute(): Promise<boolean> {
    return this.queueRepository.resetQueue();
  }
}
