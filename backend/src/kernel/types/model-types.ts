import { Maybe, MaybeUndefined } from '../common';
import type {
  Brand,
  GenreId,
  HiddenMusicTrackId,
  ImageSearchId,
  MusicLibraryId,
  MusicTrackId,
  PlaylistId,
  PlaylistSortingId,
  PlaylistTrackId,
  QueueItemId,
  SavedFilterId,
  SessionId,
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
  | SavedFilter
  | QueueItem
  | HiddenMusicTrack
  | Session;

export type ModelBase<
  Id extends string | Brand<T, string> = string,
  T = unknown,
> = {
  id: Id;
  createdAt: Date;
  createdById: UserId;
  updatedAt: MaybeUndefined<Date>;
  updatedById: MaybeUndefined<UserId>;
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
export type HiddenMusicTrack = Readonly<ModelBase<HiddenMusicTrackId>> & {
  artist: string;
  title: string;
  imagePath: string;
  libraryId: MusicLibraryId;
  fileInfo: AudioFileInfo;
  technicalInfo: MaybeUndefined<AudioTechnical>;
  aiMetadata: MaybeUndefined<AudioFileAIMetadata>;
};

export type MusicTrack = Readonly<ModelBase<MusicTrackId>> & {
  artist: MaybeUndefined<string>;
  title: MaybeUndefined<string>;
  imagePath?: string;
  libraryId: MusicLibraryId;
  stats: MaybeUndefined<MusicTrackStats>;
  fileInfo: AudioFileInfo;
  technicalInfo: MaybeUndefined<AudioTechnical>;
  features: MaybeUndefined<AudioFileFeatures>;
  metadata: MaybeUndefined<AudioFileMetadata>;
  aiMetadata: MaybeUndefined<AudioFileAIMetadata>;
  analysisInfo: MaybeUndefined<AudioFileAnalysis>;
};

export type MusicTrackStats = {
  listeningCount: number;
  lastPlayedAt: MaybeUndefined<Date>;
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
  duration: MaybeUndefined<number>;
  format: string;
  bitrate: MaybeUndefined<number>;
  sampleRate: MaybeUndefined<number>;
};

export type AudioFileMetadata = {
  album: MaybeUndefined<string>;
  duration: MaybeUndefined<number>;
  date: MaybeUndefined<Date>;
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
  musicalFeatures: MaybeUndefined<AudioFileMusicalFeatures>;
  spectralFeatures: MaybeUndefined<AudioFileSpectralFeatures>;
  melodicFeatures: MaybeUndefined<AudioFileMelodicFeatures>;
  fingerprint: MaybeUndefined<AudioFileFingerprint>;
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
  energy?: number;
  valence?: number;
  valenceMood: string;
  calculationFeatures?: CalculationFeatures;
  danceability?: number;
  danceabilityFeeling: string;
  arousal?: number;
  arousalMood: string;
  acousticness?: number;
  instrumentalness?: number;
  speechiness?: number;
  liveness?: number;
  energyComment?: string;
  energyKeywords?: string[];
};

export type AudioFileAIMetadata = {
  description: MaybeUndefined<string>;
  tags: string[];
  vocalsDesc: MaybeUndefined<string>;
  atmosphereDesc: string[];
  contextBackground: MaybeUndefined<string>;
  contextImpact: MaybeUndefined<string>;
};
export enum AudioFileAnalysisStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export const audioFileAnalysisStatusKeys = [
  AudioFileAnalysisStatusEnum.PENDING,
  AudioFileAnalysisStatusEnum.PROCESSING,
  AudioFileAnalysisStatusEnum.COMPLETED,
  AudioFileAnalysisStatusEnum.FAILED,
] as const;

export type AudioFileAnalysis = {
  status: MaybeUndefined<AudioFileAnalysisStatusEnum>;
  startedAt: MaybeUndefined<Date>;
  completedAt: MaybeUndefined<Date>;
  error: MaybeUndefined<string>;
};

const scanStatusKeys = ['IDLE', 'SCANNING', 'ANALYZING', 'ERROR'] as const;
export type ScanStatus = (typeof scanStatusKeys)[number];

export enum ScanStatusEnum {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  ANALYZING = 'ANALYZING',
  ERROR = 'ERROR',
}

type MusicLibraryTracksInfo = {
  totalTracks: number;
  analyzedTracks: number;
  pendingTracks: number;
  failedTracks: number;
};
type MusicLibraryScanInfo = {
  lastScanAt: Maybe<Date>;
  lastIncrementalScanAt: Maybe<Date>;
  scanStatus: Maybe<ScanStatus>;
};
type MusicLibrarySettings = {
  scanInterval: number;
  autoScan: boolean;
  includeSubdirectories: boolean;
  supportedFormats: string[];
  maxFileSize: number;
};
export type MusicLibrary = Readonly<ModelBase<MusicLibraryId>> & {
  name: string;
  rootPath: string;
  tracksInfo: MusicLibraryTracksInfo;
  scanInfo: MusicLibraryScanInfo;
  settings: MusicLibrarySettings;
};

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

export type Session = Readonly<ModelBase<SessionId>> & {
  status: ScanStatus;
  totalBatches: number;
  completedBatches: number;
  totalTracks: number;
  completedTracks: number;
  failedTracks: number;
  overallProgress: number;
  startedAt: Date;
  completedAt: MaybeUndefined<Date>;
  errorMessage: MaybeUndefined<string>;
};
