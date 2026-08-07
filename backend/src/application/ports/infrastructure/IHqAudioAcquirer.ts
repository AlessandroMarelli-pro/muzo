import { createToken } from '../../utils/create-token';

export type HqAudioAcquireResult = {
  filePath: string;
  format: 'flac' | 'wav';
};

export const HQ_AUDIO_ACQUIRER = createToken<IHqAudioAcquirer>('HQ_AUDIO_ACQUIRER');

export const HQ_AUDIO_ACQUIRER_SOCKSEEK_ONLY = createToken<IHqAudioAcquirer>(
  'HQ_AUDIO_ACQUIRER_SOCKSEEK_ONLY',
);

export interface IHqAudioAcquirer {
  acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null>;
}
