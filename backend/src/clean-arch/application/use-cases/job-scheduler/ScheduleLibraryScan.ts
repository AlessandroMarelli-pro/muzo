import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
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
    const library = await this.musicLibraryRepository.getOneById(libraryId);

    const { sessionId } =
      await this.libraryScanSchedulerProducer.scheduleLibraryScan(
        libraryId,
        library.rootPath,
        library.name,
        incremental,
      );

    await this.musicLibraryRepository.updateScanStatus(
      libraryId,
      'SCANNING',
      incremental,
    );

    return { sessionId };
  }
}
