export const AUDIO_WAVEFORM_GENERATOR = Symbol('IAudioWaveformGenerator');

export interface WaveformOptions {
  width?: number;
  height?: number;
  samplesPerPixel?: number;
  normalize?: boolean;
}

export interface IAudioWaveformGenerator {
  generateWaveform(filePath: string): Promise<number[]>;
}
