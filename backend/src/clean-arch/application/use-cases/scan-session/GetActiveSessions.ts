import { Session } from 'src/clean-arch/kernel/types';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class GetActiveSessionsUseCase {
  constructor(private readonly scanSessionRepository: IScanSessionRepository) {}

  async execute(): Promise<Session[]> {
    return this.scanSessionRepository.getActiveSessions();
  }
}
