import { SessionId } from 'src/clean-arch/kernel/ids';
import { createToken } from '../../utils/create-token';

export const AUDIO_SCAN_SCHEDULER_CONSUMER =
  createToken<IAudioScanSchedulerConsumer>('AUDIO_SCAN_SCHEDULER_CONSUMER');

export interface IAudioScanSchedulerConsumer {
  consumeBatchAudioScan(sessionId: SessionId): Promise<void>;
}
