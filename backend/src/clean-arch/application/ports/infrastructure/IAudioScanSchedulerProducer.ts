import { MusicLibraryId, SessionId } from 'src/clean-arch/kernel/ids';
import { ActionContext } from 'src/clean-arch/kernel/types';
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
  ): Promise<{ sessionId: SessionId }>;
}
