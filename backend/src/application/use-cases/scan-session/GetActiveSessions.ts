import { Session } from 'src/kernel/types';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class GetActiveSessionsUseCase {
  constructor(
    private readonly scanSessionRepository: IScanSessionRepository,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('GetActiveSessionsUseCase');
  }

  async execute(): Promise<Session[]> {
    return this.scanSessionRepository.getActiveSessions();
  }
}
