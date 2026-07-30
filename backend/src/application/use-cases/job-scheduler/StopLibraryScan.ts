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
    } else {
      await this.scanSessionRepository.deleteAllSessionsForLibrary(libraryId);
      this.logger.info(
        `Successfully stopped library scan for library ${libraryId} with all sessions deleted`,
      );
    }

    return true;
  }
}
