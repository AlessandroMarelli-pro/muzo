import { createToken } from '../../utils/create-token';

export type HqAudioEnhanceResult = {
  filePath: string;
};

export const HQ_AUDIO_ENHANCER = createToken<IHqAudioEnhancer>('HQ_AUDIO_ENHANCER');

export interface IHqAudioEnhancer {
  enhance(inputFilePath: string, outputDir: string): Promise<HqAudioEnhanceResult>;
}
