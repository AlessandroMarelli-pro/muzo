import { MusicTrackId } from 'src/kernel/ids';
import { createToken } from '../../utils/create-token';
import { AudioAnalysisResponse, DiscogsClassifiers, DiscogsTempo } from '../dtos/AudioAnalysis';

export const AUDIO_ANALYSIS_REPOSITORY = createToken<IAudioAnalysisRepository>(
  'AUDIO_ANALYSIS_REPOSITORY',
);

export interface IAudioAnalysisRepository {
  upsertAudioFingerprint(
    trackId: MusicTrackId,
    analysisResult: AudioAnalysisResponse,
  ): Promise<void>;

  upsertTrackGenres(trackId: MusicTrackId, genres: string[]): Promise<void>;
  upsertTrackSubgenres(trackId: MusicTrackId, subgenres: string[]): Promise<void>;
  upsertAiAtmosphereTags(trackId: MusicTrackId, tags: string[]): Promise<void>;

  /** Scalar-only update -- does not touch any other AudioFingerprint column. */
  updateEmbedding(trackId: MusicTrackId, embedding: number[]): Promise<void>;

  /** Scalar-only update -- does not touch any other AudioFingerprint column. */
  updateDiscogsClassifiers(
    trackId: MusicTrackId,
    classifiers: DiscogsClassifiers,
    tempo?: DiscogsTempo,
  ): Promise<void>;
}
