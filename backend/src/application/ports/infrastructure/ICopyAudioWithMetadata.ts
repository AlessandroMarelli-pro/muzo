import { createToken } from '../../utils/create-token';
import type { WavMetadata } from './IWavConverterWithMetadata';

export const COPY_AUDIO_WITH_METADATA = createToken<ICopyAudioWithMetadata>('COPY_AUDIO_WITH_METADATA');

export interface ICopyAudioWithMetadata {
  copyAudioWithMetadata(
    inputPath: string,
    outputPath: string,
    metadata: WavMetadata,
    imagePath?: string,
  ): Promise<void>;

  copyAudio(inputPath: string, outputPath: string): Promise<void>;
}

