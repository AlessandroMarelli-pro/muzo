import { HqAudioSource } from 'src/kernel/types/model-types';
import { createToken } from '../../utils/create-token';

export type HqAudioAcquireResult = {
  filePath: string;
  format: 'flac' | 'wav' | 'm4a' | 'aiff' | 'aif';
  /**
   * Which source produced the file. Individual acquirers may omit it; the
   * composite cascade stamps it from the acquirer that succeeded.
   */
  source?: HqAudioSource;
  /**
   * Spectral fake-lossless verdict, set by the composite when verification is
   * enabled. Undefined means "not checked" (e.g. non-lossless container).
   */
  verified?: boolean;
  /** Measured high-frequency cutoff in Hz from verification, if run. */
  spectralCutoffHz?: number | null;
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
