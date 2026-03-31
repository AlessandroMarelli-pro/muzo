import { createToken } from '../../utils/create-token';
import type { WavMetadata } from './IWavConverterWithMetadata';

export const M4A_CONVERTER_WITH_METADATA_AND_ARTWORK = createToken<
  IM4AConverterWithMetadataAndArtwork
>('M4A_CONVERTER_WITH_METADATA_AND_ARTWORK');

export interface IM4AConverterWithMetadataAndArtwork {
  convertToM4aWithMetadata(
    inputPath: string,
    outputPath: string,
    metadata: WavMetadata,
  ): Promise<void>;

  convertToM4aWithMetadataAndArtwork(
    inputPath: string,
    outputPath: string,
    metadata: WavMetadata,
    artworkPath: string,
  ): Promise<void>;
}

