import { createToken } from '../../utils/create-token';

export const WAV_CONVERTER_WITH_METADATA = createToken<IWavConverterWithMetadata>(
  'WAV_CONVERTER_WITH_METADATA',
);

export type WavMetadata = {
  artist: string;
  title: string;
  genre: string;
  style: string;
  comment: string;
};

export interface IWavConverterWithMetadata {
  convertToWavWithMetadata(
    inputPath: string,
    outputPath: string,
    metadata: WavMetadata,
  ): Promise<void>;

  /**
   * Converts to WAV without writing custom metadata fields.
   * Used as a diagnostic fallback when metadata-tagging breaks conversion.
   */
  convertToWav(inputPath: string, outputPath: string): Promise<void>;
}

