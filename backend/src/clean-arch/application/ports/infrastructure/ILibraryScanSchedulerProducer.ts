import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import { createToken } from '../../utils/create-token';

export const LIBRARY_SCAN_SCHEDULER_PRODUCER =
  createToken<ILibraryScanSchedulerProducer>('LIBRARY_SCAN_SCHEDULER');
export interface ILibraryScanSchedulerProducer {
  scheduleLibraryScan(
    libraryId: MusicLibraryId,
    rootPath: string,
    libraryName: string,
    incremental: boolean,
  ): Promise<{ sessionId: string }>;
}
