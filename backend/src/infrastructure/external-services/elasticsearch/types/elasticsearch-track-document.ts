import { MusicTrackId } from 'src/kernel/ids';

export interface ElasticsearchTrackDocument {
  // MusicTrack core fields
  trackId: MusicTrackId;
  duration: number;
  // Original Metadata
  title: string;
  artist: string;
  album: string;
  year: number;
  date: string;
  // Genres and Subgenres (from normalized relations)
  genres: string[];
  subgenres: string[];

  tags: string[];
  vocals_desc: string;
  atmosphere_desc: string[];
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
}
