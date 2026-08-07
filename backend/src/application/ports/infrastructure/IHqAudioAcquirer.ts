import { createToken } from '../../utils/create-token';

export type HqAudioAcquireResult = {
  filePath: string;
  format: 'flac' | 'wav' | 'm4a';
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
