import { MusicTrackId } from 'src/clean-arch/kernel/ids';

export interface TrackIndexDocument {
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
  mfcc?: number[];
  chromaMean?: number[]; // 12-dimensional pitch class distribution
  chromaOverallMean?: number;
  chromaDominantPitch?: number;
  tonnetzMean?: number[]; // 6-dimensional tonal centroid
  tonnetzOverallMean?: number;
  spectralCentroid?: number;
  spectralRolloff?: number;
  zeroCrossingRate?: number;
  acousticness?: number;
  instrumentalness?: number;
  speechiness?: number;
  liveness?: number;
  rhythmStability?: number;
  bassPresence?: number;
  tempoRegularity?: number;
  syncopation?: number;
  beatStrength?: number;
  brightnessFactor?: number;
  harmonicFactor?: number;
  spectralBalance?: number;
  modeFactor?: number;
  energyKeywords?: string[];
  energyComment?: string;
  // AI metadata fields
  aiDescriptions?: string[]; // Aggregated descriptions from playlist tracks
  aiTags?: string[]; // Aggregated tags from playlist tracks
  vocalsDescriptions?: string;
  atmosphereKeywords?: string[]; // Aggregated atmosphere keywords
  contextBackgrounds?: string; // Aggregated context backgrounds
  contextImpacts?: string; // Aggregated context impacts
}
