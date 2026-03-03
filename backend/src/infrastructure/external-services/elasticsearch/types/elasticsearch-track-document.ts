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

  musical_audio_features: {
    tempo: number;
    key: string;
    camelot_key: string;
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
    mfcc_mean?: number[];
  };
}
