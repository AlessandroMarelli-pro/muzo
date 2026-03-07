import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  EndLibraryScanJobData,
  LibraryScanJobData,
} from 'src/application/ports/dtos/JobSchedulersData';
import { ILibraryScanSchedulerProducer } from 'src/application/ports/infrastructure/ILibraryScanSchedulerProducer';
import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';

@Injectable()
export class LibraryScanSchedulerProducerAdapter implements ILibraryScanSchedulerProducer {
  constructor(
    @InjectQueue('library-scan')
    private readonly libraryScanQueue: Queue<LibraryScanJobData>,
  ) {}

  async scheduleLibraryScan(
    libraryId: MusicLibraryId,
    incremental: boolean,
    contextUser: ActionContext['user'],
    sessionId: SessionId,
  ): Promise<{ sessionId: SessionId }> {
    await this.libraryScanQueue.add('start-library-scan', {
      libraryId,
      sessionId,
      incremental,
      contextUser,
    });
    return { sessionId };
  }

  async scheduleEndLibraryScan(
    libraryId: MusicLibraryId,
    sessionId: SessionId,
    contextUser: ActionContext['user'],
    incremental: boolean,
  ): Promise<{ sessionId: SessionId }> {
    const jobData: EndLibraryScanJobData = {
      libraryId,
      incremental,
      sessionId,
      contextUser,
    };

    await this.libraryScanQueue.add('end-scan-library', jobData);
    return { sessionId };
  }
}
