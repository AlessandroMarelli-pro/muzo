import { Maybe, MaybeUndefined } from '../common';
import type {
  Brand,
  CosineTrackMatchId,
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
  | CosineTrackMatch
  | TrackGenre
  | Genre
  | TrackSubgenre
  | Subgenre
  | SavedFilter
  | QueueItem
  | HiddenMusicTrack
  | Session;

export type ModelBase<Id extends string | Brand<T, string> = string, T = unknown> = {
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

export type PlaylistSortingDirection = (typeof playlistSortingDirections)[number];

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
};

export type MusicTrack = Readonly<ModelBase<MusicTrackId>> & {
  artist: MaybeUndefined<string>;
  title: MaybeUndefined<string>;
  imagePath?: string;
  hqAudioPath?: string;
  libraryId: MusicLibraryId;
  stats: MaybeUndefined<MusicTrackStats>;
  fileInfo: AudioFileInfo;
  technicalInfo: MaybeUndefined<AudioTechnical>;
  features: MaybeUndefined<AudioFileFeatures>;
  metadata: MaybeUndefined<AudioFileMetadata>;
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

export type AudioFileFeatures = {
  musicalFeatures: MaybeUndefined<AudioFileMusicalFeatures>;
  /** 1280-dim discogs-effnet embedding (Essentia) when present from analysis. */
  embedding?: number[];
  embeddingDim?: number;
  instruments?: { instrument: string; confidence: number }[];
  tags?: { tag: string; confidence: number }[];
  /** Names exactly which model produced nothing and why; empty when everything ran. */
  warnings?: { model: string; reason: 'disabled' | 'failed' | 'empty'; detail: string | null }[];
};

export type AudioFileMusicalFeatures = {
  tempo?: number;
  /** The only feature that carries a model confidence today. */
  tempoConfidence?: number;
  key?: string;
  camelotKey?: string;
  mode?: string;
  valence?: number;
  valenceMood?: string;
  danceability?: number;
  danceabilityFeeling?: string;
  arousal?: number;
  arousalMood?: string;
  instrumentalness?: number;
  voice?: number;
  moodHappy?: number;
  moodSad?: number;
  moodRelaxed?: number;
  moodAggressive?: number;
  moodParty?: number;
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

export type CosineTrackMatch = Readonly<ModelBase<CosineTrackMatchId>> & {
  musicTrackId: MusicTrackId;
  cosineTrackId: string;
  matchMethod: 'search' | 'youtube-lookup';
};

export type TrackGenre = Readonly<ModelBase<TrackGenreId>> & {
  trackId: MusicTrackId;
  genreId: GenreId;
  confidence: Maybe<number>;
};

export type Genre = Readonly<ModelBase<GenreId>> & {
  name: string;
  description: Maybe<string>;
};

export type TrackSubgenre = Readonly<ModelBase<TrackSubgenreId>> & {
  trackId: MusicTrackId;
  subgenreId: SubgenreId;
  confidence: Maybe<number>;
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
  instrumentalness: Maybe<{ min?: number; max?: number }>;
  artist: Maybe<string>;
  title: Maybe<string>;
  libraryIds: Maybe<MusicLibraryId[]>;
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
  libraryId: MaybeUndefined<MusicLibraryId>;
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
