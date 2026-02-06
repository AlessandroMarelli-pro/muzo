import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LibraryScanJobData } from 'src/clean-arch/application/ports/dtos/JobSchedulersData';
import { ILibraryScanSchedulerProducer } from 'src/clean-arch/application/ports/infrastructure/ILibraryScanSchedulerProducer';
import { MusicLibraryId, SessionId } from 'src/clean-arch/kernel/ids';
import { ActionContext, models } from 'src/clean-arch/kernel/types';

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
    incremental: boolean,
    contextUser: ActionContext['user'],
  ): Promise<{ sessionId: SessionId }> {
    //TOOD: update later
    const sessionId = models.session.id('SESSION');
    await this.libraryScanQueue.add('start-library-scan', {
      libraryId,
      sessionId,
      incremental,
      contextUser,
    });
    return { sessionId };
  }
}
