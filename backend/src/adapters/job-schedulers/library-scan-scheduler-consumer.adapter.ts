import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  EndLibraryScanJobData,
  LibraryScanJobData,
} from 'src/application/ports/dtos/JobSchedulersData';
import { ILibraryScanSchedulerConsumer } from 'src/application/ports/infrastructure/ILibraryScanSchedulerConsumer';
import { ProcessEndLibraryScanUseCase } from 'src/application/use-cases/job-scheduler/ProcessEndLibraryScan';
import { ProcessStartLibraryScanUseCase } from 'src/application/use-cases/job-scheduler/ProcessStartLibraryScan';
import { ScheduleBatchAudioScanUseCase } from 'src/application/use-cases/job-scheduler/ScheduleBatchAudioScan';
import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { als } from 'src/kernel/types/context';

@Processor('library-scan')
export class LibraryScanSchedulerConsumerAdapter
  extends WorkerHost
  implements ILibraryScanSchedulerConsumer
{
  constructor(
    private readonly processStartLibraryScanUseCase: ProcessStartLibraryScanUseCase,
    private readonly scheduleBatchAudioScanUseCase: ScheduleBatchAudioScanUseCase,
    private readonly processEndLibraryScanUseCase: ProcessEndLibraryScanUseCase,
  ) {
    super();
  }

  async process(job: Job<LibraryScanJobData | EndLibraryScanJobData>): Promise<void> {
    const { libraryId, sessionId, incremental, contextUser } = job.data;
    return als.run({ now: new Date(), user: contextUser }, async () => {
      switch (job.name) {
        case 'start-library-scan':
          await job.updateProgress(0);
          await this.consumeLibraryScan(libraryId, sessionId, incremental);
          await job.updateProgress(100);
          break;
        case 'end-scan-library':
          await job.updateProgress(0);
          await this.consumeEndLibraryScan(job.data as EndLibraryScanJobData);
          await job.updateProgress(100);
          break;
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    });
  }

  async consumeLibraryScan(
    libraryId: MusicLibraryId,
    sessionId: SessionId,
    incremental: boolean,
  ): Promise<void> {
    const audioFiles = await this.processStartLibraryScanUseCase.execute(libraryId, incremental);
    if (audioFiles.length === 0) {
      await this.processEndLibraryScanUseCase.execute(libraryId, sessionId, incremental);
      return;
    }
    await this.scheduleBatchAudioScanUseCase.execute(audioFiles, libraryId, sessionId, incremental);
  }

  async consumeEndLibraryScan(data: EndLibraryScanJobData): Promise<void> {
    const { libraryId, sessionId, incremental } = data;
    await this.processEndLibraryScanUseCase.execute(libraryId, sessionId, incremental);
  }
}
