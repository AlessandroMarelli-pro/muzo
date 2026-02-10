import { MusicLibraryId, SessionId } from 'src/clean-arch/kernel/ids';
import { getCurrentUser } from 'src/clean-arch/kernel/types';
import { ILibraryScanSchedulerProducer } from '../../ports/infrastructure/ILibraryScanSchedulerProducer';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class ScheduleLibraryScanUseCase {
  constructor(
    private readonly libraryScanSchedulerProducer: ILibraryScanSchedulerProducer,
    private readonly musicLibraryRepository: IMusicLibraryRepository,
    private readonly scanSessionRepository: IScanSessionRepository,
  ) {}

  async execute(
    libraryId: MusicLibraryId,
    incremental: boolean,
  ): Promise<{ sessionId: SessionId }> {
    const { id } = await this.scanSessionRepository.createSession(null);

    await this.libraryScanSchedulerProducer.scheduleLibraryScan(
      libraryId,
      incremental,
      getCurrentUser(),
      id,
    );

    await this.musicLibraryRepository.updateScanStatus(
      libraryId,
      'SCANNING',
      incremental,
    );

    return { sessionId: id };
  }
}
