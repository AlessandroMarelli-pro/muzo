import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import { ActionContext } from 'src/clean-arch/kernel/types';
import { createToken } from '../../utils/create-token';

export const LIBRARY_SCAN_SCHEDULER_PRODUCER =
  createToken<ILibraryScanSchedulerProducer>('LIBRARY_SCAN_SCHEDULER');

export interface ILibraryScanSchedulerProducer {
  scheduleLibraryScan(
    libraryId: MusicLibraryId,
    incremental: boolean,
    contextUser: ActionContext['user'],
  ): Promise<{ sessionId: string }>;
}
