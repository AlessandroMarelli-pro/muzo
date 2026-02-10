import { Session } from 'src/clean-arch/kernel/types';
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
    this.logger.info('Getting active sessions');
    const sessions = await this.scanSessionRepository.getActiveSessions();
    this.logger.info(`Found ${sessions.length} active sessions`);
    return sessions;
  }
}
