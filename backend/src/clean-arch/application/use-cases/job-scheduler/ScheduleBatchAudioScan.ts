import { FileInfo } from 'src/clean-arch/application/ports/dtos/FileInfo';
import { IAudioScanSchedulerProducer } from 'src/clean-arch/application/ports/infrastructure/IAudioScanSchedulerProducer';
import { MusicLibraryId, SessionId } from 'src/clean-arch/kernel/ids';
import { getCurrentUser } from 'src/clean-arch/kernel/types';
import { ILogger } from '../../ports/infrastructure/ILogger';

export class ScheduleBatchAudioScanUseCase {
  constructor(
    private readonly audioScanSchedulerProducer: IAudioScanSchedulerProducer,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {}

  async execute(
    audioFiles: FileInfo[],
    libraryId: MusicLibraryId,
    sessionId: SessionId,
    incremental: boolean,
  ): Promise<{ sessionId: string }> {
    this.logger.info(
      `Scheduling batch audio scan for ${audioFiles.length} files in library ${libraryId}`,
    );
    await this.audioScanSchedulerProducer.scheduleBatchAudioScan(
      audioFiles,
      libraryId,
      sessionId,
      getCurrentUser(),
      incremental,
    );
    this.logger.info(
      `Successfully scheduled batch audio scan for ${audioFiles.length} files in library ${libraryId}`,
    );
    return { sessionId };
  }
}
