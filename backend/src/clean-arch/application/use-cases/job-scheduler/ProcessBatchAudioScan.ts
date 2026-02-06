import { IAudioAnalysisStructure } from '../../ports/infrastructure/IAudioAnalysisStructure';

export class ProcessBatchAudioScanUseCase {
  constructor(
    private readonly audioAnalysisStructure: IAudioAnalysisStructure,
  ) {}

  async execute(
    audioFilePaths: string[],
    sessionId?: string,
    batchIndex?: number,
    skipImageSearch?: boolean,
  ): Promise<void> {
    const result = await this.audioAnalysisStructure.analyzeAudioBatch(
      audioFilePaths,
      sessionId,
      batchIndex,
      skipImageSearch,
    );
    console.log(result);
  }
}
