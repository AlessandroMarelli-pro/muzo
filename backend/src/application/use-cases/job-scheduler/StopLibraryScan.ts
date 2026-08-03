import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class StopLibraryScanUseCase {
  constructor(
    private readonly musicLibraryRepository: IMusicLibraryRepository,
    private readonly scanSessionRepository: IScanSessionRepository,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('StopLibraryScanUseCase');
  }

  async execute(libraryId: MusicLibraryId, sessionId: SessionId | null): Promise<boolean> {
    this.logger.info(`Stopping library scan for library ${libraryId} with session ${sessionId}`);
    await this.musicLibraryRepository.updateScanStatus(libraryId, 'IDLE');
    if (sessionId) {
      await this.scanSessionRepository.deleteSession(sessionId);
      this.logger.info(
        `Successfully stopped library scan for library ${libraryId} with session ${sessionId}`,
      );
      return true;
    }

    // No sessionId supplied by the caller: resolve the active session for this specific
    // library and stop only that one. Never fall back to deleting every session the user has.
    const activeSessions = await this.scanSessionRepository.getActiveSessions();
    const target = activeSessions.find((session) => session.libraryId === libraryId);
    if (!target) {
      this.logger.warn(`No active session found for library ${libraryId}; nothing to stop`);
      return false;
    }

    await this.scanSessionRepository.deleteSession(target.id);
    this.logger.info(
      `Successfully stopped library scan for library ${libraryId} with session ${target.id}`,
    );
    return true;
  }
}
