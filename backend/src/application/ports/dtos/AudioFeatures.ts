import { MusicTrackId } from 'src/kernel/ids';

export type AudioFeatures = {
  trackId: MusicTrackId;
  tempo?: { min: number; max: number };
  /** Center BPM for soft tempo scoring; typically `(tempo.min + tempo.max) / 2`. */
  tempoCenter?: number;
  key?: string;
  camelotKey?: string;
  valence?: number;
  valenceMood?: string;
  arousal?: number;
  arousalMood?: string;
  danceability?: number;
  danceabilityFeeling?: string;
  instrumentalness?: number;
  voice?: number;
  moodHappy?: number;
  moodSad?: number;
  moodRelaxed?: number;
  moodAggressive?: number;
  moodParty?: number;
  genres?: string[];
  subgenres?: string[];
  artist?: string;
  album?: string;
  // AI metadata fields
  aiDescriptions?: string[]; // Aggregated descriptions from playlist tracks
  aiTags?: string[]; // Aggregated tags from playlist tracks
  vocalsDescriptions?: string;
  atmosphereKeywords?: string[]; // Aggregated atmosphere keywords
  contextBackgrounds?: string; // Aggregated context backgrounds
  contextImpacts?: string; // Aggregated context impacts
  /** 1280-dim discogs-effnet embedding (Essentia) for acoustic similarity search. */
  embedding?: number[];
};
