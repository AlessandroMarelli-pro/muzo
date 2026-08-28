import { MusicTrackId } from 'src/kernel/ids';
import { AggregationStatistics } from 'src/kernel/types';

export type AudioFeatures = {
  trackId: MusicTrackId;
  tempo?: { min: number; max: number };
  /** Center BPM for soft tempo scoring; typically `(tempo.min + tempo.max) / 2`. */
  tempoCenter?: number;
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
  spectralFeatures?: SpectralFeatures;
  /** Dominant pitch class 0–11 from chroma (aggregated from seed tracks). */
  chromaDominantPitch?: number;
  onsetDensity?: number;
  dynamicRange?: number;
  bassPresence?: number;
  energyByBand?: [number, number, number];
  energyRatios?: [number, number, number];
  // Discogs-effnet classifier heads (run on the embedding, comparison-only for now)
  discogsDanceability?: number;
  discogsMoodAggressive?: number;
  discogsMoodHappy?: number;
  discogsMoodParty?: number;
  discogsMoodRelaxed?: number;
  discogsMoodSad?: number;
  discogsGenres?: { genre: string; style: string; confidence: number }[];
  discogsVoice?: number;
  discogsInstruments?: { instrument: string; confidence: number }[];
  discogsTags?: { tag: string; confidence: number }[];
  discogsTempo?: number;
  discogsTempoConfidence?: number;
};

export type SpectralFeatures = {
  spectralCentroidMean?: AggregationStatistics;
  spectralRolloffMean?: AggregationStatistics;
  spectralSpreadMean?: AggregationStatistics;
  spectralBandwidthMean?: AggregationStatistics;
  spectralFlatnessMean?: AggregationStatistics;
  zeroCrossingRateMean?: AggregationStatistics;
  spectralContrastMean?: AggregationStatistics;
  mfccMean?: number[];
  /** Per-coefficient MFCC std (13); timbral variability. */
  mfccStd?: number[];
  /** 1280-dim discogs-effnet embedding (Essentia) for acoustic similarity search. */
  embedding?: number[];
};
