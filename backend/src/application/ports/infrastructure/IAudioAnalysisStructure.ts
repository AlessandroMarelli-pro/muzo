import { createToken } from '../../utils/create-token';
import {
  AudioAnalysisBatchResponse,
  DiscogsClassifiers,
  DiscogsTempo,
} from '../dtos/AudioAnalysis';

export const AUDIO_ANALYSIS_STRUCTURE = createToken<IAudioAnalysisStructure>(
  'AUDIO_ANALYSIS_STRUCTURE',
);

export interface IAudioAnalysisStructure {
  analyzeAudioBatch(
    audioFilePaths: string[],
    sessionId?: string,
    batchIndex?: number,
    skipImageSearch?: boolean,
    skipAiMetadata?: boolean,
  ): Promise<AudioAnalysisBatchResponse>;

  extractDiscogsEmbedding(audioFilePath: string): Promise<{
    embedding: number[];
    discogsClassifiers: DiscogsClassifiers;
    discogsTempo: DiscogsTempo;
  }>;
}
