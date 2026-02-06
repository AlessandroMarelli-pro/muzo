import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ILibraryScanSchedulerProducer } from 'src/clean-arch/application/ports/infrastructure/ILibraryScanSchedulerProducer';
import { MusicLibraryId } from 'src/clean-arch/kernel/ids';

interface LibraryScanJobData {
  libraryId: string;
  rootPath: string;
  libraryName: string;
  sessionId?: string; // Optional for backward compatibility
  incremental: boolean;
}

@Injectable()
export class LibraryScanSchedulerProducerAdapter
  implements ILibraryScanSchedulerProducer
{
  constructor(
    @InjectQueue('library-scan')
    private readonly libraryScanQueue: Queue<LibraryScanJobData>,
  ) {}

  async scheduleLibraryScan(
    libraryId: MusicLibraryId,
    rootPath: string,
    libraryName: string,
    incremental: boolean,
  ): Promise<{ sessionId: string }> {
    //TOOD: update later
    const sessionId = '';
    await this.libraryScanQueue.add('start-library-scan', {
      libraryId,
      libraryName,
      rootPath,
      sessionId,
      incremental,
    });
    return { sessionId };
  }
}
