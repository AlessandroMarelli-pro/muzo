import { createToken } from '../../utils/create-token';
import { AudioScanBatchJobData } from '../dtos/JobSchedulersData';

export const AUDIO_SCAN_SCHEDULER_CONSUMER = createToken<IAudioScanSchedulerConsumer>(
  'AUDIO_SCAN_SCHEDULER_CONSUMER',
);

export interface IAudioScanSchedulerConsumer {
  consumeBatchAudioScan(data: AudioScanBatchJobData): Promise<void>;
}
