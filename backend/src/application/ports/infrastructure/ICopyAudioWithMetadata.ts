import { createToken } from '../../utils/create-token';
import type { WavMetadata } from './IWavConverterWithMetadata';

export const COPY_AUDIO_WITH_METADATA = createToken<ICopyAudioWithMetadata>('COPY_AUDIO_WITH_METADATA');

// Cover art is only ever available as bytes read from the DB (image_searches.image_data) --
// there is no filesystem path for it. Keeping this type local (rather than importing
// TrackImage from IImageSearchRepository) avoids an infrastructure port depending on a
// repository port; a TrackImage value assigns to it with no cast.
export type AudioArtwork = {
  data: Buffer;
  mimeType: string;
};

export interface ICopyAudioWithMetadata {
  copyAudioWithMetadata(
    inputPath: string,
    outputPath: string,
    metadata: WavMetadata,
    artwork?: AudioArtwork,
  ): Promise<void>;

  copyAudio(inputPath: string, outputPath: string): Promise<void>;
}

