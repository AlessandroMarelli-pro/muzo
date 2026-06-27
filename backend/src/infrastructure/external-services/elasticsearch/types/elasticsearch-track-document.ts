import { MusicTrackId } from 'src/kernel/ids';
import { AggregationStatistics } from 'src/kernel/types';

export interface ElasticsearchTrackDocument {
  // MusicTrack core fields
  trackId: MusicTrackId;
  duration: number;
  // Original Metadata
  title: string;
  artist: string;
  album: string;
  year: number;
  /** Omitted when track has no release date (Elasticsearch date type cannot parse empty string) */
  date?: string;
  // Genres and Subgenres (from normalized relations)
  genres: string[];
  subgenres: string[];

  tags: string[];
  vocals_desc: string;
  atmosphere_tags: string[];
  context_background: string;
  context_impact: string;

  chroma_dominant_pitch?: number;

  musical_audio_features: {
    tempo: number;
    key: string;
    camelot_key: string;
    /** Normalized loudness / energy factor (0–1) for similarity. */
    energy: number;
    valence: number;
    valence_mood: string;
    arousal: number;
    arousal_mood: string;
    danceability: number;
    danceability_feeling: string;
  };
  spectral_features: {
    spectral_centroid?: AggregationStatistics;
    spectral_rolloff?: AggregationStatistics;
    spectral_spread?: AggregationStatistics;
    spectral_bandwidth?: AggregationStatistics;
    spectral_flatness?: AggregationStatistics;
    zero_crossing_rate?: AggregationStatistics;
    spectral_contrast?: AggregationStatistics;
    mfcc_mean?: number[];
    /** 13 MFCC coefficient std values (timbral variability). */
    mfcc_std?: number[];
    onset_density?: number;
    dynamic_range?: number;
    bass_presence?: number;
    energy_by_band?: {
      bass: number;
      mid: number;
      high: number;
    };
    energy_ratios?: {
      bass: number;
      mid: number;
      high: number;
    };
  };
}
