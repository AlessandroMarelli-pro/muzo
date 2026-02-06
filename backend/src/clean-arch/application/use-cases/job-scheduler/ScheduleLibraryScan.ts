import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import { getCurrentUser } from 'src/clean-arch/kernel/types';
import { ILibraryScanSchedulerProducer } from '../../ports/infrastructure/ILibraryScanSchedulerProducer';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';

export class ScheduleLibraryScanUseCase {
  constructor(
    private readonly libraryScanSchedulerProducer: ILibraryScanSchedulerProducer,
    private readonly musicLibraryRepository: IMusicLibraryRepository,
  ) {}

  async execute(
    libraryId: MusicLibraryId,
    incremental: boolean,
  ): Promise<{ sessionId: string }> {
    const { sessionId } =
      await this.libraryScanSchedulerProducer.scheduleLibraryScan(
        libraryId,
        incremental,
        getCurrentUser(),
      );

    await this.musicLibraryRepository.updateScanStatus(
      libraryId,
      'SCANNING',
      incremental,
    );

    return { sessionId };
  }
}
