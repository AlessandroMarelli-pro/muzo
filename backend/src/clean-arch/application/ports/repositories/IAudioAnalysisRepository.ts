import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { createToken } from '../../utils/create-token';
import { AudioAnalysisResponse } from '../dtos/AudioAnalysis';

export const AUDIO_ANALYSIS_REPOSITORY = createToken<IAudioAnalysisRepository>(
  'AUDIO_ANALYSIS_REPOSITORY',
);

export interface IAudioAnalysisRepository {
  upsertAudioFingerprint(
    trackId: MusicTrackId,
    analysisResult: AudioAnalysisResponse,
  ): Promise<void>;

  upsertTrackGenres(trackId: MusicTrackId, genres: string[]): Promise<void>;
  upsertTrackSubgenres(
    trackId: MusicTrackId,
    subgenres: string[],
  ): Promise<void>;
}
