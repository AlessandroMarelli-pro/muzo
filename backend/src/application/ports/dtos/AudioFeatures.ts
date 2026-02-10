import { MusicTrackId } from 'src/kernel/ids';

export type AudioFeatures = {
  trackId: MusicTrackId;
  tempo?: number;
  key?: string;
  camelotKey?: string;
  energy?: number;
  valence?: number;
  valenceMood?: string;
  arousal?: number;
  arousalMood?: string;
  danceability?: number;
  danceabilityFeeling?: string;
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
};
