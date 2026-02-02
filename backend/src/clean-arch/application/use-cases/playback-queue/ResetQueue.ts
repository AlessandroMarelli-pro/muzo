import { Inject, Injectable } from '@nestjs/common';
import {
  IQueueRepository,
  QUEUE_REPOSITORY,
} from '../../ports/repositories/IQueueRepository';

@Injectable()
export class ResetQueueUseCase {
  constructor(
    @Inject(QUEUE_REPOSITORY)
    private readonly queueRepository: IQueueRepository,
  ) {}

  async execute(): Promise<boolean> {
    return this.queueRepository.resetQueue();
  }
}
