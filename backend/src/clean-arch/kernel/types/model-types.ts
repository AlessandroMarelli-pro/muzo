import { Maybe } from '../common';
import type {
  Brand,
  GenreId,
  ImageSearchId,
  MusicLibraryId,
  MusicTrackId,
  PlaylistId,
  PlaylistSortingId,
  PlaylistTrackId,
  QueueItemId,
  SavedFilterId,
  SubgenreId,
  TrackGenreId,
  TrackSubgenreId,
  UserId,
} from '../ids'; // or your ids index
import { Email, Name } from './value-object';

export type ActionContext = {
  now: Date;
  user: User;
};

export type Model =
  | Playlist
  | User
  | PlaylistTrack
  | MusicTrack
  | PlaylistSorting
  | MusicLibrary
  | ImageSearch
  | TrackGenre
  | Genre
  | TrackSubgenre
  | Subgenre
  | SavedFilter;

export type ModelBase<
  Id extends string | Brand<T, string> = string,
  T = unknown,
> = {
  id: Id;
  createdAt: Date;
  createdById: UserId;
  updatedAt: Date;
  updatedById: Maybe<UserId>;
};

export type Playlist = Readonly<ModelBase<PlaylistId>> & {
  name: string;
  description: Maybe<string>;
  isPublic: boolean;
  isFavorite: boolean;
};

export type User = Readonly<
  ModelBase<UserId> & {
    email: Email;
    firstName: Maybe<Name>;
    lastName: Maybe<Name>;
  }
>;

export type PlaylistTrack = Readonly<ModelBase<PlaylistTrackId>> & {
  trackId: MusicTrackId;
  playlistId: PlaylistId;
  position: number;
  addedAt: Date;
};

export const playlistSortingKeys = ['addedAt', 'position'] as const;

export type PlaylistSortingKey = (typeof playlistSortingKeys)[number];

export const playlistSortingDirections = ['asc', 'desc'] as const;

export type PlaylistSortingDirection =
  (typeof playlistSortingDirections)[number];

export type PlaylistSorting = Readonly<ModelBase<PlaylistSortingId>> & {
  playlistId: PlaylistId;
  sortingKey: PlaylistSortingKey;
  sortingDirection: PlaylistSortingDirection;
};

export type MusicTrack = Readonly<ModelBase<MusicTrackId>> & {
  artist: string;
  title: string;
  imagePath: string;
  libraryId: MusicLibraryId;
  stats: MusicTrackStats;
  fileInfo: AudioFileInfo;
  technicalInfo: AudioTechnical;
  features: AudioFileFeatures;
  metadata: AudioFileMetadata;
  aiMetadata: AudioFileAIMetadata;
  analysisInfo: AudioFileAnalysis;
};

export type MusicTrackStats = {
  listeningCount: number;
  lastPlayedAt: Date;
  isFavorite: boolean;
  isLiked: boolean;
  isBanger: boolean;
};

export type AudioFileInfo = {
  filePath: string;
  fileName: string;
  fileSize: number;
  fileCreatedAt: Date;
};

export type AudioTechnical = {
  duration: number;
  format: string;
  bitrate: number;
  sampleRate: number;
};

export type AudioFileMetadata = {
  album: string;
  duration: number;
  date: Date;
  genres: string[];
  subgenres: string[];
};

export type AggregationStatistics = {
  mean: number;
  std: number;
  median: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
};
export type AudioFileSpectralFeatures = {
  spectralCentroid: AggregationStatistics;
  spectralRolloff: AggregationStatistics;
  zeroCrossingRate: AggregationStatistics;
  mfcc: number[];
  spectralSpread: AggregationStatistics;
  spectralBandwith: AggregationStatistics;
  spectralFlatness: AggregationStatistics;
};

export type MelodicFeatures = {
  mean: number[];
  std: number[];
  max: number[];
  overallMean: number;
  overallStd: number;
};
export type AudioFileMelodicFeatures = {
  chroma: MelodicFeatures & {
    dominant_pitch: number;
  };
  tonnetz: MelodicFeatures;
};
export type AudioFileFeatures = {
  musicalFeatures: AudioFileMusicalFeatures;
  spectralFeatures: AudioFileSpectralFeatures;
  melodicFeatures: AudioFileMelodicFeatures;
  fingerprint: AudioFileFingerprint;
};
export type AudioFileFingerprint = {
  fileHash: string;
  audioHash: string;
};
type CalculationFeatures = {
  modeFactor: number;
  modeConfidence: number;
  modeWeight: number;
  tempoFactor: number;
  energyFactor: number;
  brightnessFactor: number;
  harmonicFactor: number;
  spectralBalance: number;
  beatStrength: number;
  syncopation: number;
  rhythmStability: number;
  bassPresence: number;
  tempoRegularity: number;
  tempoAppropriateness: number;
};
export type AudioFileMusicalFeatures = {
  tempo: number;
  key: string;
  camelotKey: string;
  energy: number;
  valence: number;
  valenceMood: string;
  calculationFeatures: CalculationFeatures;
  danceability: number;
  danceabilityFeeling: string;
  arousal: number;
  arousalMood: string;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  liveness: number;
  energyComment: string;
  energyKeywords: string[];
};

export type AudioFileAIMetadata = {
  description: string;
  tags: string[];
  vocalsDesc: string;
  atmosphereDesc: string[];
  contextBackground: string;
  contextImpact: string;
};
export const audioFileAnalysisStatusKeys = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
] as const;

export type AudioFileAnalysisStatus =
  (typeof audioFileAnalysisStatusKeys)[number];

export type AudioFileAnalysis = {
  status: AudioFileAnalysisStatus;
  startedAt: Date;
  completedAt: Date;
  error: Maybe<string>;
};

export type MusicLibrary = Readonly<ModelBase<MusicLibraryId>> & {};

export type ImageSearch = Readonly<ModelBase<ImageSearchId>> & {
  trackId: MusicTrackId;
  searchUrl: string;
  imagePath: string;
  imageUrl: string;
  error: Maybe<string>;
};

export type TrackGenre = Readonly<ModelBase<TrackGenreId>> & {
  trackId: MusicTrackId;
  genreId: GenreId;
};

export type Genre = Readonly<ModelBase<GenreId>> & {
  name: string;
  description: Maybe<string>;
};

export type TrackSubgenre = Readonly<ModelBase<TrackSubgenreId>> & {
  trackId: MusicTrackId;
  subgenreId: SubgenreId;
};

export type Subgenre = Readonly<ModelBase<SubgenreId>> & {
  name: string;
  description: Maybe<string>;
  genreId: Maybe<GenreId>;
};

export type SavedFilter = Readonly<ModelBase<SavedFilterId>> & {
  name: string;
  criteria: FilterCriteria;
  isCurrent: boolean;
};

export type FilterCriteria = {
  genreIds: Maybe<GenreId[]>;
  subgenreIds: Maybe<SubgenreId[]>;
  keyIds: Maybe<string[]>;
  tempo: Maybe<{ min?: number; max?: number }>;
  valenceMood: Maybe<string[]>;
  arousalMood: Maybe<string[]>;
  danceabilityFeeling: Maybe<string[]>;
  speechiness: Maybe<{ min?: number; max?: number }>;
  instrumentalness: Maybe<{ min?: number; max?: number }>;
  liveness: Maybe<{ min?: number; max?: number }>;
  acousticness: Maybe<{ min?: number; max?: number }>;
  artist: Maybe<string>;
  title: Maybe<string>;
  libraryIds: Maybe<MusicLibraryId[]>;
  atmosphereIds: Maybe<string[]>;
};

export type QueueItem = Readonly<ModelBase<QueueItemId>> & {
  trackId: MusicTrackId;
  position: number;
};

export type RecommendationWeights = {
  audioSimilarity: number; // MFCC, chroma, spectral features
  genreSimilarity: number; // AI genre + subgenre classification
  metadataSimilarity: number; // Artist, album, year patterns
  userBehavior: number; // Listening history, favorites
  audioFeatures: number; // Tempo, key, energy, valence
  aiMetadataSimilarity: number; // AI description, tags, vocals, atmosphere, context
};

export type RecommendationCriteria = {
  weights: RecommendationWeights;
  limit?: number;
  excludeTrackIds?: MusicTrackId[];
};

export type TrackSimilarity = {
  track: MusicTrack;
  similarity: number;
  reasons: string[];
};
