import { Session } from 'src/kernel/types';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class GetCompleteSessionsUseCase {
  constructor(
    private readonly scanSessionRepository: IScanSessionRepository,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('GetCompleteSessionsUseCase');
  }

  async execute(): Promise<Session[]> {
    this.logger.info('Getting completed sessions');
    const sessions = await this.scanSessionRepository.getCompletedSessions();
    this.logger.info(`Found ${sessions.length} completed sessions`);
    return sessions;
  }
}
