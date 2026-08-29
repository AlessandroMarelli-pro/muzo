import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';
import { createToken } from '../../utils/create-token';
import { FileInfo } from '../dtos/FileInfo';

export const AUDIO_SCAN_SCHEDULER_PRODUCER =
  createToken<IAudioScanSchedulerProducer>('AUDIO_SCAN_SCHEDULER');

export interface IAudioScanSchedulerProducer {
  scheduleBatchAudioScan(
    audioFiles: FileInfo[],
    libraryId: MusicLibraryId,
    sessionId: SessionId,
    contextUser: ActionContext['user'],
    incremental: boolean,
    force?: boolean,
  ): Promise<{ sessionId: SessionId }>;
}
