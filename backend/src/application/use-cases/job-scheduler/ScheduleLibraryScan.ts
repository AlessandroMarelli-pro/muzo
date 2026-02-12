import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { getCurrentUser } from 'src/kernel/types';
import { ILibraryScanSchedulerProducer } from '../../ports/infrastructure/ILibraryScanSchedulerProducer';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class ScheduleLibraryScanUseCase {
  constructor(
    private readonly libraryScanSchedulerProducer: ILibraryScanSchedulerProducer,
    private readonly musicLibraryRepository: IMusicLibraryRepository,
    private readonly scanSessionRepository: IScanSessionRepository,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('ScheduleLibraryScanUseCase');
  }

  async execute(
    libraryId: MusicLibraryId,
    incremental: boolean,
  ): Promise<{ sessionId: SessionId }> {
    const { id } = await this.scanSessionRepository.createSession(null);
    try {
      this.logger.info(`Creating session for library ${libraryId}`);
      await this.libraryScanSchedulerProducer.scheduleLibraryScan(
        libraryId,
        incremental,
        getCurrentUser(),
        id,
      );
      this.logger.info(
        `Successfully scheduled library scan for library ${libraryId} with session ${id}`,
      );
      await this.musicLibraryRepository.updateScanStatus(libraryId, 'SCANNING');
      this.logger.info(
        `Successfully updated library ${libraryId} scan status to SCANNING with session ${id}`,
      );
      return { sessionId: id };
    } catch (error) {
      this.logger.error(
        `Failed to schedule library scan for library ${libraryId}:`,
        error,
      );
      await this.musicLibraryRepository.updateScanStatus(libraryId, 'IDLE');
      await this.scanSessionRepository.deleteSession(id);
      throw error;
    }
  }
}
