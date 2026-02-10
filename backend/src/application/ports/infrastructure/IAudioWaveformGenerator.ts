import { createToken } from '../../utils/create-token';

export const AUDIO_WAVEFORM_GENERATOR = createToken<IAudioWaveformGenerator>(
  'AUDIO_WAVEFORM_GENERATOR',
);

export interface WaveformOptions {
  width?: number;
  height?: number;
  samplesPerPixel?: number;
  normalize?: boolean;
}

export interface IAudioWaveformGenerator {
  generateWaveform(filePath: string): Promise<number[]>;
}
