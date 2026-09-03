import { HqAudioSource } from 'src/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export type HqAudioAcquireResult = {
  filePath: string;
  format: 'flac' | 'wav' | 'm4a' | 'aiff';
  /**
   * Which source produced the file. Individual acquirers may omit it; the
   * composite cascade stamps it from the acquirer that succeeded.
   */
  source?: HqAudioSource;
};

export const HQ_AUDIO_ACQUIRER = createToken<IHqAudioAcquirer>('HQ_AUDIO_ACQUIRER');

export interface IHqAudioAcquirer {
  acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null>;
}
