import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import { createToken } from '../../utils/create-token';
import { EndLibraryScanJobData } from '../dtos/JobSchedulersData';

export const LIBRARY_SCAN_SCHEDULER_CONSUMER =
  createToken<ILibraryScanSchedulerConsumer>('LIBRARY_SCAN_SCHEDULER_CONSUMER');

export interface ILibraryScanSchedulerConsumer {
  consumeLibraryScan(
    libraryId: MusicLibraryId,
    sessionId: string,
    incremental: boolean,
  ): Promise<void>;
  consumeEndLibraryScan(data: EndLibraryScanJobData): Promise<void>;
}
