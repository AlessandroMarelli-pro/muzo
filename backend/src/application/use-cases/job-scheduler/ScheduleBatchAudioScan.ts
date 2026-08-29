import { FileInfo } from 'src/application/ports/dtos/FileInfo';
import { IAudioScanSchedulerProducer } from 'src/application/ports/infrastructure/IAudioScanSchedulerProducer';
import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { getCurrentUser } from 'src/kernel/types';
import { ILogger } from '../../ports/infrastructure/ILogger';

export class ScheduleBatchAudioScanUseCase {
  constructor(
    private readonly audioScanSchedulerProducer: IAudioScanSchedulerProducer,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('ScheduleBatchAudioScanUseCase');
  }

  async execute(
    audioFiles: FileInfo[],
    libraryId: MusicLibraryId,
    sessionId: SessionId,
    incremental: boolean,
    force?: boolean,
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
      force,
    );
    this.logger.info(
      `Successfully scheduled batch audio scan for ${audioFiles.length} files in library ${libraryId}`,
    );
    return { sessionId };
  }
}
