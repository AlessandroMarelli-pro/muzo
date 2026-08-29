import { MusicTrackId } from 'src/kernel/ids';
import { createToken } from '../../utils/create-token';
import {
  AnalysisClassifications,
  AudioAnalysisResponse,
  DiscogsClassifiers,
  DiscogsTempo,
} from '../dtos/AudioAnalysis';

export const AUDIO_ANALYSIS_REPOSITORY = createToken<IAudioAnalysisRepository>(
  'AUDIO_ANALYSIS_REPOSITORY',
);

export interface IAudioAnalysisRepository {
  upsertAudioFingerprint(
    trackId: MusicTrackId,
    analysisResult: AudioAnalysisResponse,
  ): Promise<void>;

  /**
   * Replaces a track's genre/subgenre associations from the Discogs
   * genre_discogs400 classifications (genre -> Genre, style -> Subgenre,
   * each carrying its prediction confidence).
   */
  upsertTrackGenresFromClassifications(
    trackId: MusicTrackId,
    classifications: AnalysisClassifications,
  ): Promise<void>;

  /** Scalar-only update -- does not touch any other AudioFingerprint column. */
  updateEmbedding(trackId: MusicTrackId, embedding: number[]): Promise<void>;

  /** Scalar-only update -- does not touch any other AudioFingerprint column. */
  updateDiscogsClassifiers(
    trackId: MusicTrackId,
    classifiers: DiscogsClassifiers,
    tempo?: DiscogsTempo,
  ): Promise<void>;
}
