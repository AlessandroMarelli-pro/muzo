import { FileInfo } from 'src/clean-arch/application/ports/dtos/FileInfo';
import { IAudioScanSchedulerProducer } from 'src/clean-arch/application/ports/infrastructure/IAudioScanSchedulerProducer';
import { MusicLibraryId, SessionId } from 'src/clean-arch/kernel/ids';
import { getCurrentUser } from 'src/clean-arch/kernel/types';

export class ScheduleBatchAudioScanUseCase {
  constructor(
    private readonly audioScanSchedulerProducer: IAudioScanSchedulerProducer,
  ) {}

  async execute(
    audioFiles: FileInfo[],
    libraryId: MusicLibraryId,
    sessionId: SessionId,
  ): Promise<{ sessionId: string }> {
    await this.audioScanSchedulerProducer.scheduleBatchAudioScan(
      audioFiles,
      libraryId,
      sessionId,
      getCurrentUser(),
    );
    return { sessionId };
  }
}
