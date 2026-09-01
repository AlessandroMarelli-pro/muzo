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
  /** Omitted when track has no release date (Elasticsearch date type cannot parse empty string) */
  date?: string;
  // Genres and Subgenres (from normalized relations)
  genres: string[];
  subgenres: string[];
  /** mtg_jamendo_instrument labels (top-5, confidence >= 0.15). Empty when unanalyzed. */
  instruments: string[];

  /**
   * All fields optional: a track whose analysis model didn't run for that
   * feature omits the field entirely rather than indexing a placeholder
   * (`0`/`''`). A `gauss` function on a missing field contributes nothing to
   * the score instead of being scored as maximally distant from every seed.
   */
  musical_audio_features: {
    tempo?: number;
    key?: string;
    camelot_key?: string;
    valence?: number;
    valence_mood?: string;
    arousal?: number;
    arousal_mood?: string;
    danceability?: number;
    danceability_feeling?: string;
    instrumentalness?: number;
    voice?: number;
    mood_happy?: number;
    mood_sad?: number;
    mood_relaxed?: number;
    mood_aggressive?: number;
    mood_party?: number;
  };
  audio_features: {
    /** 1280-dim discogs-effnet embedding (Essentia) for acoustic similarity search. */
    discogs_embedding?: number[];
  };
}
