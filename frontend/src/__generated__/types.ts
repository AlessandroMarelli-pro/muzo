export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: any; output: any; }
};

export type AiAnalysisResult = {
  __typename?: 'AIAnalysisResult';
  albumSuggestion?: Maybe<Scalars['String']['output']>;
  artistSuggestion?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  errorMessage?: Maybe<Scalars['String']['output']>;
  fingerprintId: Scalars['ID']['output'];
  genreClassification: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  modelVersion: Scalars['String']['output'];
  processingTime: Scalars['Float']['output'];
  trackId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type AddTrackInput = {
  filePath: Scalars['String']['input'];
  libraryId: Scalars['ID']['input'];
};

export type AddTrackToPlaylistInput = {
  position?: InputMaybe<Scalars['Int']['input']>;
  trackId: Scalars['ID']['input'];
};

export type AnalysisPreferences = {
  __typename?: 'AnalysisPreferences';
  autoAnalyze: Scalars['Boolean']['output'];
  confidenceThreshold: Scalars['Float']['output'];
  preferredGenres?: Maybe<Array<Scalars['String']['output']>>;
  skipLowConfidence: Scalars['Boolean']['output'];
};

export type AnalysisPreferencesInput = {
  autoAnalyze?: InputMaybe<Scalars['Boolean']['input']>;
  confidenceThreshold?: InputMaybe<Scalars['Float']['input']>;
  preferredGenres?: InputMaybe<Array<Scalars['String']['input']>>;
  skipLowConfidence?: InputMaybe<Scalars['Boolean']['input']>;
};

export type AudioAnalysisResult = {
  __typename?: 'AudioAnalysisResult';
  acousticness: Scalars['Float']['output'];
  analysisVersion: Scalars['String']['output'];
  beats: Array<BeatData>;
  danceability: Scalars['Float']['output'];
  duration: Scalars['Float']['output'];
  energy: Array<EnergyData>;
  instrumentalness: Scalars['Float']['output'];
  key: Scalars['String']['output'];
  liveness: Scalars['Float']['output'];
  mode: Scalars['String']['output'];
  speechiness: Scalars['Float']['output'];
  tempo: Scalars['Float']['output'];
  valence: Scalars['Float']['output'];
};

export type AudioFingerprint = {
  __typename?: 'AudioFingerprint';
  acousticness?: Maybe<Scalars['Float']['output']>;
  chroma?: Maybe<Array<Scalars['Float']['output']>>;
  createdAt: Scalars['DateTime']['output'];
  danceability?: Maybe<Scalars['Float']['output']>;
  energy?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  instrumentalness?: Maybe<Scalars['Float']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  mfcc?: Maybe<Array<Scalars['Float']['output']>>;
  spectralCentroid?: Maybe<Scalars['Float']['output']>;
  spectralContrast?: Maybe<Array<Scalars['Float']['output']>>;
  spectralRolloff?: Maybe<Scalars['Float']['output']>;
  speechiness?: Maybe<Scalars['Float']['output']>;
  tempo?: Maybe<Scalars['Float']['output']>;
  trackId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
  valence?: Maybe<Scalars['Float']['output']>;
  zeroCrossingRate?: Maybe<Scalars['Float']['output']>;
};

export type AudioInfo = {
  __typename?: 'AudioInfo';
  bitrate?: Maybe<Scalars['Float']['output']>;
  contentType: Scalars['String']['output'];
  duration: Scalars['Float']['output'];
  fileName: Scalars['String']['output'];
  fileSize: Scalars['Float']['output'];
  format: Scalars['String']['output'];
  sampleRate?: Maybe<Scalars['Int']['output']>;
  trackId: Scalars['ID']['output'];
};

export type BeatData = {
  __typename?: 'BeatData';
  confidence: Scalars['Float']['output'];
  strength: Scalars['Float']['output'];
  timestamp: Scalars['Float']['output'];
};

export type CreateLibraryInput = {
  autoScan?: InputMaybe<Scalars['Boolean']['input']>;
  includeSubdirectories?: InputMaybe<Scalars['Boolean']['input']>;
  maxFileSize?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  rootPath: Scalars['String']['input'];
  scanInterval?: InputMaybe<Scalars['Int']['input']>;
  supportedFormats?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreatePlaylistInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateSavedFilterInput = {
  criteria: FilterCriteriaInput;
  name: Scalars['String']['input'];
};

export type DeleteImageResponse = {
  __typename?: 'DeleteImageResponse';
  success: Scalars['Boolean']['output'];
};

export type EditorPreferences = {
  __typename?: 'EditorPreferences';
  autoSave: Scalars['Boolean']['output'];
  batchMode: Scalars['Boolean']['output'];
  showConfidenceScores: Scalars['Boolean']['output'];
  undoLevels: Scalars['Float']['output'];
};

export type EditorPreferencesInput = {
  autoSave?: InputMaybe<Scalars['Boolean']['input']>;
  batchMode?: InputMaybe<Scalars['Boolean']['input']>;
  showConfidenceScores?: InputMaybe<Scalars['Boolean']['input']>;
  undoLevels?: InputMaybe<Scalars['Float']['input']>;
};

export type EnergyData = {
  __typename?: 'EnergyData';
  energy: Scalars['Float']['output'];
  frequency: Scalars['Float']['output'];
  timestamp: Scalars['Float']['output'];
};

export type FilterCriteriaInput = {
  acousticness?: InputMaybe<RangeInput>;
  arousalMood?: InputMaybe<Array<Scalars['String']['input']>>;
  artist?: InputMaybe<Scalars['String']['input']>;
  danceabilityFeeling?: InputMaybe<Array<Scalars['String']['input']>>;
  genres?: InputMaybe<Array<Scalars['String']['input']>>;
  instrumentalness?: InputMaybe<RangeInput>;
  keys?: InputMaybe<Array<Scalars['String']['input']>>;
  liveness?: InputMaybe<RangeInput>;
  speechiness?: InputMaybe<RangeInput>;
  subgenres?: InputMaybe<Array<Scalars['String']['input']>>;
  tempo?: InputMaybe<RangeInput>;
  valenceMood?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type FilterCriteriaType = {
  __typename?: 'FilterCriteriaType';
  acousticness?: Maybe<Range>;
  arousalMood?: Maybe<Array<Scalars['String']['output']>>;
  artist?: Maybe<Scalars['String']['output']>;
  danceabilityFeeling?: Maybe<Array<Scalars['String']['output']>>;
  genres?: Maybe<Array<Scalars['String']['output']>>;
  instrumentalness?: Maybe<Range>;
  keys?: Maybe<Array<Scalars['String']['output']>>;
  liveness?: Maybe<Range>;
  speechiness?: Maybe<Range>;
  subgenres?: Maybe<Array<Scalars['String']['output']>>;
  tempo?: Maybe<Range>;
  valenceMood?: Maybe<Array<Scalars['String']['output']>>;
};

export type FilterOptions = {
  __typename?: 'FilterOptions';
  acousticnessRange: Range;
  instrumentalnessRange: Range;
  livenessRange: Range;
  speechinessRange: Range;
  tempoRange: Range;
};

export type FormatDistribution = {
  __typename?: 'FormatDistribution';
  count: Scalars['Int']['output'];
  format: Scalars['String']['output'];
};

export type GenreDistribution = {
  __typename?: 'GenreDistribution';
  count: Scalars['Int']['output'];
  genre: Scalars['String']['output'];
};

export type ImageSearch = {
  __typename?: 'ImageSearch';
  id: Scalars['ID']['output'];
  imagePath: Scalars['String']['output'];
  imageUrl: Scalars['String']['output'];
  source: Scalars['String']['output'];
};

export type ImageSearchResultType = {
  __typename?: 'ImageSearchResultType';
  createdAt: Scalars['DateTime']['output'];
  error?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imagePath?: Maybe<Scalars['String']['output']>;
  imageUrl?: Maybe<Scalars['String']['output']>;
  searchUrl: Scalars['String']['output'];
  status: Scalars['String']['output'];
  trackId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type ImageUrlResponse = {
  __typename?: 'ImageUrlResponse';
  url?: Maybe<Scalars['String']['output']>;
};

export type IntelligentEditorSession = {
  __typename?: 'IntelligentEditorSession';
  confidenceThreshold?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  sessionStatus: Scalars['String']['output'];
  suggestions: Scalars['String']['output'];
  trackId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
  userActions: Scalars['String']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
};

export type LibraryMetrics = {
  __typename?: 'LibraryMetrics';
  artistCount: Scalars['Int']['output'];
  formatDistribution: Array<FormatDistribution>;
  genreDistribution: Array<GenreDistribution>;
  listeningStats: ListeningStats;
  recentActivity: Array<RecentActivity>;
  subgenreDistribution: Array<SubgenreDistribution>;
  topArtists: Array<TopArtist>;
  topGenres: Array<TopGenre>;
  totalListeningTime: Scalars['Float']['output'];
  totalTracks: Scalars['Int']['output'];
  yearDistribution: Array<YearDistribution>;
};

export type LibraryQueryOptions = {
  limit?: InputMaybe<Scalars['Float']['input']>;
  offset?: InputMaybe<Scalars['Float']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
};

export type LibraryScanProgressUpdate = {
  __typename?: 'LibraryScanProgressUpdate';
  estimatedCompletion?: Maybe<Scalars['DateTime']['output']>;
  libraryId: Scalars['ID']['output'];
  libraryName: Scalars['String']['output'];
  processedFiles: Scalars['Float']['output'];
  progressPercentage: Scalars['Float']['output'];
  remainingFiles: Scalars['Float']['output'];
  status: Scalars['String']['output'];
  totalFiles: Scalars['Float']['output'];
};

export type LibraryScanResult = {
  __typename?: 'LibraryScanResult';
  errors: Scalars['Float']['output'];
  estimatedCompletion?: Maybe<Scalars['DateTime']['output']>;
  libraryId: Scalars['ID']['output'];
  newTracks: Scalars['Float']['output'];
  processedFiles: Scalars['Float']['output'];
  scanId: Scalars['ID']['output'];
  status: Scalars['String']['output'];
  totalFiles: Scalars['Float']['output'];
  updatedTracks: Scalars['Float']['output'];
};

export type LibrarySettings = {
  __typename?: 'LibrarySettings';
  autoScan: Scalars['Boolean']['output'];
  includeSubdirectories: Scalars['Boolean']['output'];
  maxFileSize?: Maybe<Scalars['Float']['output']>;
  scanInterval?: Maybe<Scalars['Float']['output']>;
  supportedFormats: Array<Scalars['String']['output']>;
};

export type ListeningStats = {
  __typename?: 'ListeningStats';
  averageConfidence: Scalars['Float']['output'];
  favoriteCount: Scalars['Int']['output'];
  totalPlayTime: Scalars['Float']['output'];
  totalPlays: Scalars['Int']['output'];
};

export type MusicLibrary = {
  __typename?: 'MusicLibrary';
  analyzedTracks: Scalars['Float']['output'];
  autoScan: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  failedTracks: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  includeSubdirectories: Scalars['Boolean']['output'];
  lastIncrementalScanAt?: Maybe<Scalars['DateTime']['output']>;
  lastScanAt?: Maybe<Scalars['DateTime']['output']>;
  maxFileSize?: Maybe<Scalars['Float']['output']>;
  name: Scalars['String']['output'];
  pendingTracks: Scalars['Float']['output'];
  rootPath: Scalars['String']['output'];
  scanInterval?: Maybe<Scalars['Float']['output']>;
  scanStatus: Scalars['String']['output'];
  settings: LibrarySettings;
  supportedFormats: Scalars['String']['output'];
  totalTracks: Scalars['Float']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type MusicTrack = {
  __typename?: 'MusicTrack';
  aiAlbum?: Maybe<Scalars['String']['output']>;
  aiArtist?: Maybe<Scalars['String']['output']>;
  aiConfidence?: Maybe<Scalars['Float']['output']>;
  aiDescription?: Maybe<Scalars['String']['output']>;
  aiSubgenreConfidence?: Maybe<Scalars['Float']['output']>;
  aiTags?: Maybe<Array<Scalars['String']['output']>>;
  aiTitle?: Maybe<Scalars['String']['output']>;
  albumArtPath?: Maybe<Scalars['String']['output']>;
  analysisCompletedAt?: Maybe<Scalars['DateTime']['output']>;
  analysisError?: Maybe<Scalars['String']['output']>;
  analysisResult?: Maybe<AiAnalysisResult>;
  analysisStartedAt?: Maybe<Scalars['DateTime']['output']>;
  analysisStatus: Scalars['String']['output'];
  audioFingerprint?: Maybe<AudioFingerprint>;
  bitrate?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  duration: Scalars['Float']['output'];
  editorSession?: Maybe<IntelligentEditorSession>;
  fileName: Scalars['String']['output'];
  filePath: Scalars['String']['output'];
  fileSize: Scalars['Float']['output'];
  format: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  imageSearches?: Maybe<Array<ImageSearch>>;
  isFavorite: Scalars['Boolean']['output'];
  lastPlayedAt?: Maybe<Scalars['DateTime']['output']>;
  libraryId: Scalars['ID']['output'];
  listeningCount: Scalars['Float']['output'];
  originalAlbum?: Maybe<Scalars['String']['output']>;
  originalArtist?: Maybe<Scalars['String']['output']>;
  originalTitle?: Maybe<Scalars['String']['output']>;
  originalYear?: Maybe<Scalars['Float']['output']>;
  sampleRate?: Maybe<Scalars['Float']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  userAlbum?: Maybe<Scalars['String']['output']>;
  userArtist?: Maybe<Scalars['String']['output']>;
  userTags?: Maybe<Array<Scalars['String']['output']>>;
  userTitle?: Maybe<Scalars['String']['output']>;
};

export type MusicTrackByCategoriesGraphQl = {
  __typename?: 'MusicTrackByCategoriesGraphQL';
  category: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  trackCount: Scalars['Float']['output'];
  tracks: Array<SimpleMusicTrack>;
};

export type MusicTrackListPaginated = {
  __typename?: 'MusicTrackListPaginated';
  limit: Scalars['Float']['output'];
  page: Scalars['Float']['output'];
  total: Scalars['Float']['output'];
  tracks: Array<SimpleMusicTrack>;
};

export type Mutation = {
  __typename?: 'Mutation';
  addTrack: MusicTrack;
  addTrackToPlaylist: PlaylistTrack;
  bangerTrack: SimpleMusicTrack;
  clearCurrentFilter: Scalars['Boolean']['output'];
  createLibrary: MusicLibrary;
  createPlaylist: Playlist;
  createSavedFilter: SavedFilter;
  deleteImageForTrack: DeleteImageResponse;
  deleteLibrary: Scalars['Boolean']['output'];
  deletePlaylist: Scalars['Boolean']['output'];
  deleteSavedFilter: Scalars['Boolean']['output'];
  deleteTrack: Scalars['Boolean']['output'];
  dislikeTrack: Scalars['Boolean']['output'];
  likeTrack: SimpleMusicTrack;
  pauseTrack: PlaybackState;
  playTrack: PlaybackState;
  recordPlayback: MusicTrack;
  removeTrackFromPlaylist: Scalars['Boolean']['output'];
  reorderPlaylistTracks: Playlist;
  resumeTrack: PlaybackState;
  scheduleLibraryScan: LibraryScanResult;
  seekTrack: PlaybackState;
  setCurrentFilter: FilterCriteriaType;
  setPlaybackRate: PlaybackState;
  setVolume: PlaybackState;
  startLibraryScan: LibraryScanResult;
  stopLibraryScan: Scalars['Boolean']['output'];
  stopTrack: Scalars['Boolean']['output'];
  toggleFavorite: MusicTrack;
  updateLibrary: MusicLibrary;
  updatePlaylist: Playlist;
  updatePreferences: UserPreferencesGraphQl;
  updateSavedFilter: SavedFilter;
  updateTrack: MusicTrack;
};


export type MutationAddTrackArgs = {
  input: AddTrackInput;
};


export type MutationAddTrackToPlaylistArgs = {
  input: AddTrackToPlaylistInput;
  playlistId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
};


export type MutationBangerTrackArgs = {
  trackId: Scalars['ID']['input'];
};


export type MutationCreateLibraryArgs = {
  input: CreateLibraryInput;
};


export type MutationCreatePlaylistArgs = {
  input: CreatePlaylistInput;
};


export type MutationCreateSavedFilterArgs = {
  input: CreateSavedFilterInput;
};


export type MutationDeleteImageForTrackArgs = {
  trackId: Scalars['ID']['input'];
};


export type MutationDeleteLibraryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePlaylistArgs = {
  id: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
};


export type MutationDeleteSavedFilterArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTrackArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDislikeTrackArgs = {
  trackId: Scalars['ID']['input'];
};


export type MutationLikeTrackArgs = {
  trackId: Scalars['ID']['input'];
};


export type MutationPauseTrackArgs = {
  trackId: Scalars['String']['input'];
};


export type MutationPlayTrackArgs = {
  startTime?: Scalars['Float']['input'];
  trackId: Scalars['String']['input'];
};


export type MutationRecordPlaybackArgs = {
  duration: Scalars['Float']['input'];
  trackId: Scalars['ID']['input'];
};


export type MutationRemoveTrackFromPlaylistArgs = {
  playlistId: Scalars['ID']['input'];
  trackId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
};


export type MutationReorderPlaylistTracksArgs = {
  input: ReorderTracksInput;
  playlistId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
};


export type MutationResumeTrackArgs = {
  trackId: Scalars['String']['input'];
};


export type MutationScheduleLibraryScanArgs = {
  libraryId: Scalars['ID']['input'];
};


export type MutationSeekTrackArgs = {
  timeInSeconds: Scalars['Float']['input'];
  trackId: Scalars['String']['input'];
};


export type MutationSetCurrentFilterArgs = {
  criteria: FilterCriteriaInput;
};


export type MutationSetPlaybackRateArgs = {
  rate: Scalars['Float']['input'];
  trackId: Scalars['String']['input'];
};


export type MutationSetVolumeArgs = {
  trackId: Scalars['String']['input'];
  volume: Scalars['Float']['input'];
};


export type MutationStartLibraryScanArgs = {
  incremental?: InputMaybe<Scalars['Boolean']['input']>;
  libraryId: Scalars['ID']['input'];
};


export type MutationStopLibraryScanArgs = {
  libraryId: Scalars['ID']['input'];
};


export type MutationStopTrackArgs = {
  trackId: Scalars['String']['input'];
};


export type MutationToggleFavoriteArgs = {
  trackId: Scalars['String']['input'];
};


export type MutationUpdateLibraryArgs = {
  id: Scalars['ID']['input'];
  input: UpdateLibraryInput;
};


export type MutationUpdatePlaylistArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePlaylistInput;
  userId: Scalars['String']['input'];
};


export type MutationUpdatePreferencesArgs = {
  input: UpdatePreferencesInput;
};


export type MutationUpdateSavedFilterArgs = {
  id: Scalars['ID']['input'];
  input: UpdateSavedFilterInput;
};


export type MutationUpdateTrackArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTrackInput;
};

export type OrganizationPreferences = {
  __typename?: 'OrganizationPreferences';
  autoOrganize: Scalars['Boolean']['output'];
  createPlaylists: Scalars['Boolean']['output'];
  exportToDJSoftware: Scalars['Boolean']['output'];
  organizationMethod: Scalars['String']['output'];
};

export type OrganizationPreferencesInput = {
  autoOrganize?: InputMaybe<Scalars['Boolean']['input']>;
  createPlaylists?: InputMaybe<Scalars['Boolean']['input']>;
  exportToDJSoftware?: InputMaybe<Scalars['Boolean']['input']>;
  organizationMethod?: InputMaybe<Scalars['String']['input']>;
};

export type PlaybackSession = {
  __typename?: 'PlaybackSession';
  currentTime: Scalars['Float']['output'];
  duration: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  startTime: Scalars['DateTime']['output'];
  trackId: Scalars['ID']['output'];
};

export type PlaybackState = {
  __typename?: 'PlaybackState';
  currentTime: Scalars['Float']['output'];
  duration: Scalars['Float']['output'];
  isFavorite: Scalars['Boolean']['output'];
  isPlaying: Scalars['Boolean']['output'];
  playbackRate: Scalars['Float']['output'];
  trackId: Scalars['ID']['output'];
  volume: Scalars['Float']['output'];
};

export type Playlist = {
  __typename?: 'Playlist';
  bpmRange: Range;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  energyRange: Range;
  genresCount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  images: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  numberOfTracks: Scalars['Int']['output'];
  subgenresCount: Scalars['Int']['output'];
  topGenres: Array<Scalars['String']['output']>;
  topSubgenres: Array<Scalars['String']['output']>;
  totalDuration: Scalars['Float']['output'];
  tracks: Array<PlaylistTrack>;
  updatedAt: Scalars['DateTime']['output'];
};

export type PlaylistItem = {
  __typename?: 'PlaylistItem';
  bpmRange: Range;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  energyRange: Range;
  genresCount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  images: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  numberOfTracks: Scalars['Int']['output'];
  subgenresCount: Scalars['Int']['output'];
  topGenres: Array<Scalars['String']['output']>;
  topSubgenres: Array<Scalars['String']['output']>;
  totalDuration: Scalars['Float']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type PlaylistStats = {
  __typename?: 'PlaylistStats';
  averageDuration: Scalars['Int']['output'];
  genreDistribution?: Maybe<Scalars['String']['output']>;
  totalDuration: Scalars['Int']['output'];
  totalTracks: Scalars['Int']['output'];
};

export type PlaylistTrack = {
  __typename?: 'PlaylistTrack';
  addedAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  position: Scalars['Int']['output'];
  track: SimpleMusicTrack;
};

export type Query = {
  __typename?: 'Query';
  getActiveSessions: Array<PlaybackSession>;
  getAudioAnalysis: AudioAnalysisResult;
  getAudioInfo: AudioInfo;
  getAudioStreamUrl: Scalars['String']['output'];
  getBeatData: Array<BeatData>;
  getCurrentFilter?: Maybe<FilterCriteriaType>;
  getDetailedWaveformData: WaveformData;
  getEnergyData: Array<EnergyData>;
  getFilterOptions: FilterOptions;
  getImageForTrack?: Maybe<ImageSearchResultType>;
  getImageSearchStatus?: Maybe<ImageSearchResultType>;
  getImageSearchesForTrack: Array<ImageSearchResultType>;
  getImageUrl: ImageUrlResponse;
  getPlaybackState?: Maybe<PlaybackState>;
  getRealTimeAnalysis: RealTimeAnalysis;
  getSavedFilter?: Maybe<SavedFilter>;
  getSavedFilters: Array<SavedFilter>;
  getStaticFilterOptions: StaticFilterOptions;
  getWaveformData: Array<Scalars['Float']['output']>;
  libraries: Array<MusicLibrary>;
  library?: Maybe<MusicLibrary>;
  libraryMetrics: LibraryMetrics;
  mostPlayed: Array<MusicTrack>;
  playlist: Playlist;
  playlistByName: Playlist;
  playlistRecommendations: Array<TrackRecommendation>;
  playlistStats: PlaylistStats;
  playlistTracks: Array<PlaylistTrack>;
  playlists: Array<PlaylistItem>;
  preferences: UserPreferencesGraphQl;
  queueStats: Scalars['String']['output'];
  randomTrack: SimpleMusicTrack;
  recentlyPlayed: Array<SimpleMusicTrack>;
  searchTracks: Array<MusicTrack>;
  track?: Maybe<MusicTrack>;
  trackRecommendations: Array<TrackRecommendation>;
  tracks: Array<SimpleMusicTrack>;
  tracksByCategories: Array<MusicTrackByCategoriesGraphQl>;
  tracksList: MusicTrackListPaginated;
};


export type QueryGetAudioAnalysisArgs = {
  trackId: Scalars['String']['input'];
};


export type QueryGetAudioInfoArgs = {
  trackId: Scalars['String']['input'];
};


export type QueryGetAudioStreamUrlArgs = {
  trackId: Scalars['String']['input'];
};


export type QueryGetBeatDataArgs = {
  trackId: Scalars['String']['input'];
};


export type QueryGetDetailedWaveformDataArgs = {
  trackId: Scalars['String']['input'];
};


export type QueryGetEnergyDataArgs = {
  trackId: Scalars['String']['input'];
};


export type QueryGetImageForTrackArgs = {
  trackId: Scalars['ID']['input'];
};


export type QueryGetImageSearchStatusArgs = {
  searchId: Scalars['ID']['input'];
};


export type QueryGetImageSearchesForTrackArgs = {
  trackId: Scalars['ID']['input'];
};


export type QueryGetImageUrlArgs = {
  trackId: Scalars['ID']['input'];
};


export type QueryGetPlaybackStateArgs = {
  trackId: Scalars['String']['input'];
};


export type QueryGetRealTimeAnalysisArgs = {
  currentTime: Scalars['Float']['input'];
  trackId: Scalars['String']['input'];
};


export type QueryGetSavedFilterArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetWaveformDataArgs = {
  trackId: Scalars['String']['input'];
};


export type QueryLibrariesArgs = {
  options?: InputMaybe<LibraryQueryOptions>;
};


export type QueryLibraryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryMostPlayedArgs = {
  limit?: Scalars['Float']['input'];
};


export type QueryPlaylistArgs = {
  id: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
};


export type QueryPlaylistByNameArgs = {
  name: Scalars['String']['input'];
};


export type QueryPlaylistRecommendationsArgs = {
  excludeTrackIds?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  playlistId: Scalars['ID']['input'];
};


export type QueryPlaylistStatsArgs = {
  playlistId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
};


export type QueryPlaylistTracksArgs = {
  playlistId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
};


export type QueryPlaylistsArgs = {
  userId: Scalars['String']['input'];
};


export type QueryRandomTrackArgs = {
  filterLiked?: InputMaybe<Scalars['Boolean']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
};


export type QueryRecentlyPlayedArgs = {
  limit?: Scalars['Float']['input'];
};


export type QuerySearchTracksArgs = {
  libraryId?: InputMaybe<Scalars['ID']['input']>;
  query: Scalars['String']['input'];
};


export type QueryTrackArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTrackRecommendationsArgs = {
  criteria?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['String']['input'];
};


export type QueryTracksArgs = {
  options?: InputMaybe<TrackQueryOptions>;
};


export type QueryTracksByCategoriesArgs = {
  options?: InputMaybe<TrackQueryOptionsByCategories>;
};


export type QueryTracksListArgs = {
  options?: InputMaybe<TrackQueryOptions>;
};

export type Range = {
  __typename?: 'Range';
  max: Scalars['Float']['output'];
  min: Scalars['Float']['output'];
};

export type RangeInput = {
  max?: InputMaybe<Scalars['Float']['input']>;
  min?: InputMaybe<Scalars['Float']['input']>;
};

export type RealTimeAnalysis = {
  __typename?: 'RealTimeAnalysis';
  beatConfidence: Scalars['Float']['output'];
  currentBeat: BeatData;
  currentEnergy: Scalars['Float']['output'];
  energyTrend: Scalars['String']['output'];
  nextBeatEstimate: Scalars['Float']['output'];
};

export type RecentActivity = {
  __typename?: 'RecentActivity';
  date: Scalars['String']['output'];
  tracksAdded: Scalars['Int']['output'];
  tracksAnalyzed: Scalars['Int']['output'];
};

export type ReorderTracksInput = {
  trackOrders: Array<TrackOrderInput>;
};

export type SavedFilter = {
  __typename?: 'SavedFilter';
  createdAt: Scalars['DateTime']['output'];
  criteria: FilterCriteriaType;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type SimpleMusicTrack = {
  __typename?: 'SimpleMusicTrack';
  acousticness?: Maybe<Scalars['Float']['output']>;
  arousalMood?: Maybe<Scalars['String']['output']>;
  artist?: Maybe<Scalars['String']['output']>;
  atmosphereKeywords?: Maybe<Array<Scalars['String']['output']>>;
  contextBackgrounds?: Maybe<Scalars['String']['output']>;
  contextImpacts?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  danceabilityFeeling?: Maybe<Scalars['String']['output']>;
  date?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  duration: Scalars['Float']['output'];
  genres?: Maybe<Array<Scalars['String']['output']>>;
  id: Scalars['ID']['output'];
  imagePath?: Maybe<Scalars['String']['output']>;
  instrumentalness?: Maybe<Scalars['Float']['output']>;
  isBanger?: Maybe<Scalars['Boolean']['output']>;
  isFavorite?: Maybe<Scalars['Boolean']['output']>;
  isLiked?: Maybe<Scalars['Boolean']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  lastPlayedAt?: Maybe<Scalars['DateTime']['output']>;
  lastScannedAt?: Maybe<Scalars['DateTime']['output']>;
  listeningCount?: Maybe<Scalars['Float']['output']>;
  speechiness?: Maybe<Scalars['Float']['output']>;
  subgenres?: Maybe<Array<Scalars['String']['output']>>;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  tempo?: Maybe<Scalars['Float']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  valenceMood?: Maybe<Scalars['String']['output']>;
  vocalsDescriptions?: Maybe<Scalars['String']['output']>;
};

export type StaticFilterOptions = {
  __typename?: 'StaticFilterOptions';
  genres: Array<Scalars['String']['output']>;
  keys: Array<Scalars['String']['output']>;
  subgenres: Array<Scalars['String']['output']>;
};

export type SubgenreDistribution = {
  __typename?: 'SubgenreDistribution';
  count: Scalars['Int']['output'];
  subgenre: Scalars['String']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  libraryScanProgress: LibraryScanProgressUpdate;
};


export type SubscriptionLibraryScanProgressArgs = {
  libraryId?: InputMaybe<Scalars['ID']['input']>;
};

export type TopArtist = {
  __typename?: 'TopArtist';
  artist: Scalars['String']['output'];
  averageConfidence: Scalars['Float']['output'];
  totalDuration: Scalars['Float']['output'];
  trackCount: Scalars['Int']['output'];
};

export type TopGenre = {
  __typename?: 'TopGenre';
  averageConfidence: Scalars['Float']['output'];
  averageDuration: Scalars['Float']['output'];
  genre: Scalars['String']['output'];
  trackCount: Scalars['Int']['output'];
};

export type TrackOrderInput = {
  position: Scalars['Int']['input'];
  trackId: Scalars['ID']['input'];
};

export type TrackQueryOptions = {
  analysisStatus?: InputMaybe<Scalars['String']['input']>;
  format?: InputMaybe<Scalars['String']['input']>;
  isFavorite?: InputMaybe<Scalars['Boolean']['input']>;
  libraryId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Float']['input']>;
  offset?: InputMaybe<Scalars['Float']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
};

export type TrackQueryOptionsByCategories = {
  analysisStatus?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  format?: InputMaybe<Scalars['String']['input']>;
  genre?: InputMaybe<Scalars['String']['input']>;
  isFavorite?: InputMaybe<Scalars['Boolean']['input']>;
  libraryId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Float']['input']>;
  offset?: InputMaybe<Scalars['Float']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
};

export type TrackRecommendation = {
  __typename?: 'TrackRecommendation';
  reasons: Array<Scalars['String']['output']>;
  similarity: Scalars['Float']['output'];
  track: SimpleMusicTrack;
};

export type UiPreferences = {
  __typename?: 'UIPreferences';
  defaultView: Scalars['String']['output'];
  language: Scalars['String']['output'];
  theme: Scalars['String']['output'];
};

export type UiPreferencesInput = {
  defaultView?: InputMaybe<Scalars['String']['input']>;
  language?: InputMaybe<Scalars['String']['input']>;
  theme?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateLibraryInput = {
  autoScan?: InputMaybe<Scalars['Boolean']['input']>;
  includeSubdirectories?: InputMaybe<Scalars['Boolean']['input']>;
  maxFileSize?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  rootPath?: InputMaybe<Scalars['String']['input']>;
  scanInterval?: InputMaybe<Scalars['Int']['input']>;
  supportedFormats?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UpdatePlaylistInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePreferencesInput = {
  analysisPreferences?: InputMaybe<AnalysisPreferencesInput>;
  editorPreferences?: InputMaybe<EditorPreferencesInput>;
  organizationPreferences?: InputMaybe<OrganizationPreferencesInput>;
  uiPreferences?: InputMaybe<UiPreferencesInput>;
};

export type UpdateSavedFilterInput = {
  criteria?: InputMaybe<FilterCriteriaInput>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTrackInput = {
  genreIds?: InputMaybe<Array<Scalars['String']['input']>>;
  subgenreIds?: InputMaybe<Array<Scalars['String']['input']>>;
  userAlbum?: InputMaybe<Scalars['String']['input']>;
  userArtist?: InputMaybe<Scalars['String']['input']>;
  userTags?: InputMaybe<Array<Scalars['String']['input']>>;
  userTitle?: InputMaybe<Scalars['String']['input']>;
};

export type UserPreferencesGraphQl = {
  __typename?: 'UserPreferencesGraphQL';
  analysisPreferences: AnalysisPreferences;
  createdAt: Scalars['DateTime']['output'];
  editorPreferences: EditorPreferences;
  id: Scalars['ID']['output'];
  organizationPreferences: OrganizationPreferences;
  uiPreferences: UiPreferences;
  updatedAt: Scalars['DateTime']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
};

export type WaveformData = {
  __typename?: 'WaveformData';
  bitDepth: Scalars['Int']['output'];
  channels: Scalars['Int']['output'];
  duration: Scalars['Float']['output'];
  peaks: Array<Scalars['Float']['output']>;
  sampleRate: Scalars['Int']['output'];
};

export type YearDistribution = {
  __typename?: 'YearDistribution';
  count?: Maybe<Scalars['Int']['output']>;
  year?: Maybe<Scalars['Int']['output']>;
};

export type GetLibrariesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetLibrariesQuery = { __typename?: 'Query', libraries: Array<{ __typename?: 'MusicLibrary', id: string, name: string, rootPath: string, totalTracks: number, analyzedTracks: number, pendingTracks: number, failedTracks: number, lastScanAt?: any | null, lastIncrementalScanAt?: any | null, scanStatus: string, createdAt: any, updatedAt: any, settings: { __typename?: 'LibrarySettings', autoScan: boolean, scanInterval?: number | null, includeSubdirectories: boolean, supportedFormats: Array<string>, maxFileSize?: number | null } }> };

export type GetLibraryQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetLibraryQuery = { __typename?: 'Query', library?: { __typename?: 'MusicLibrary', id: string, name: string, rootPath: string, totalTracks: number, analyzedTracks: number, pendingTracks: number, failedTracks: number, lastScanAt?: any | null, lastIncrementalScanAt?: any | null, scanStatus: string, createdAt: any, updatedAt: any, settings: { __typename?: 'LibrarySettings', autoScan: boolean, scanInterval?: number | null, includeSubdirectories: boolean, supportedFormats: Array<string>, maxFileSize?: number | null } } | null };

export type GetTracksQueryVariables = Exact<{
  options?: InputMaybe<TrackQueryOptions>;
}>;


export type GetTracksQuery = { __typename?: 'Query', tracks: Array<{ __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }> };

export type GetRandomTrackQueryVariables = Exact<{
  id?: InputMaybe<Scalars['String']['input']>;
  filterLiked?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetRandomTrackQuery = { __typename?: 'Query', randomTrack: { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null } };

export type GetTrackRecommendationsQueryVariables = Exact<{
  id: Scalars['String']['input'];
  criteria?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetTrackRecommendationsQuery = { __typename?: 'Query', trackRecommendations: Array<{ __typename?: 'TrackRecommendation', similarity: number, reasons: Array<string>, track: { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null } }> };

export type GetTracksListQueryVariables = Exact<{
  options?: InputMaybe<TrackQueryOptions>;
}>;


export type GetTracksListQuery = { __typename?: 'Query', tracksList: { __typename?: 'MusicTrackListPaginated', total: number, page: number, limit: number, tracks: Array<{ __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }> } };

export type GetTracksByCategoriesQueryVariables = Exact<{
  options?: InputMaybe<TrackQueryOptionsByCategories>;
}>;


export type GetTracksByCategoriesQuery = { __typename?: 'Query', tracksByCategories: Array<{ __typename?: 'MusicTrackByCategoriesGraphQL', category: string, name: string, trackCount: number, tracks: Array<{ __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }> }> };

export type GetStaticFiltersQueryVariables = Exact<{ [key: string]: never; }>;


export type GetStaticFiltersQuery = { __typename?: 'Query', getStaticFilterOptions: { __typename?: 'StaticFilterOptions', genres: Array<string>, subgenres: Array<string>, keys: Array<string> } };

export type GetRecentlyPlayedQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Float']['input']>;
}>;


export type GetRecentlyPlayedQuery = { __typename?: 'Query', recentlyPlayed: Array<{ __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }> };

export type GetMostPlayedQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Float']['input']>;
}>;


export type GetMostPlayedQuery = { __typename?: 'Query', mostPlayed: Array<{ __typename?: 'MusicTrack', id: string, fileName: string, duration: number, originalTitle?: string | null, originalArtist?: string | null, originalAlbum?: string | null, aiTitle?: string | null, aiArtist?: string | null, aiAlbum?: string | null, listeningCount: number, lastPlayedAt?: any | null, analysisStatus: string }> };

export type LikeTrackMutationVariables = Exact<{
  trackId: Scalars['ID']['input'];
}>;


export type LikeTrackMutation = { __typename?: 'Mutation', likeTrack: { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null } };

export type BangerTrackMutationVariables = Exact<{
  trackId: Scalars['ID']['input'];
}>;


export type BangerTrackMutation = { __typename?: 'Mutation', bangerTrack: { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null } };

export type DislikeTrackMutationVariables = Exact<{
  trackId: Scalars['ID']['input'];
}>;


export type DislikeTrackMutation = { __typename?: 'Mutation', dislikeTrack: boolean };

export type GetCurrentFilterQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCurrentFilterQuery = { __typename?: 'Query', getCurrentFilter?: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genres?: Array<string> | null, keys?: Array<string> | null, subgenres?: Array<string> | null, artist?: string | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, speechiness?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null, liveness?: { __typename?: 'Range', max: number, min: number } | null, acousticness?: { __typename?: 'Range', max: number, min: number } | null } | null };

export type SetCurrentFilterMutationVariables = Exact<{
  criteria: FilterCriteriaInput;
}>;


export type SetCurrentFilterMutation = { __typename?: 'Mutation', setCurrentFilter: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genres?: Array<string> | null, keys?: Array<string> | null, subgenres?: Array<string> | null, artist?: string | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, speechiness?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null, liveness?: { __typename?: 'Range', max: number, min: number } | null, acousticness?: { __typename?: 'Range', max: number, min: number } | null } };

export type ClearCurrentFilterMutationVariables = Exact<{ [key: string]: never; }>;


export type ClearCurrentFilterMutation = { __typename?: 'Mutation', clearCurrentFilter: boolean };

export type GetFilterOptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetFilterOptionsQuery = { __typename?: 'Query', getFilterOptions: { __typename?: 'FilterOptions', tempoRange: { __typename?: 'Range', max: number, min: number } } };

export type GetStaticFilterOptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetStaticFilterOptionsQuery = { __typename?: 'Query', getStaticFilterOptions: { __typename?: 'StaticFilterOptions', genres: Array<string>, keys: Array<string>, subgenres: Array<string> } };

export type GetSavedFiltersQueryVariables = Exact<{ [key: string]: never; }>;


export type GetSavedFiltersQuery = { __typename?: 'Query', getSavedFilters: Array<{ __typename?: 'SavedFilter', id: string, name: string, createdAt: any, updatedAt: any, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genres?: Array<string> | null, keys?: Array<string> | null, subgenres?: Array<string> | null, artist?: string | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, speechiness?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null, liveness?: { __typename?: 'Range', max: number, min: number } | null, acousticness?: { __typename?: 'Range', max: number, min: number } | null } }> };

export type CreateSavedFilterMutationVariables = Exact<{
  input: CreateSavedFilterInput;
}>;


export type CreateSavedFilterMutation = { __typename?: 'Mutation', createSavedFilter: { __typename?: 'SavedFilter', id: string, name: string, createdAt: any, updatedAt: any, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genres?: Array<string> | null, keys?: Array<string> | null, subgenres?: Array<string> | null, artist?: string | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, speechiness?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null, liveness?: { __typename?: 'Range', max: number, min: number } | null, acousticness?: { __typename?: 'Range', max: number, min: number } | null } } };

export type DeleteSavedFilterMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteSavedFilterMutation = { __typename?: 'Mutation', deleteSavedFilter: boolean };

export type GetLibraryMetricsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetLibraryMetricsQuery = { __typename?: 'Query', libraryMetrics: { __typename?: 'LibraryMetrics', totalTracks: number, totalListeningTime: number, artistCount: number, genreDistribution: Array<{ __typename?: 'GenreDistribution', genre: string, count: number }>, subgenreDistribution: Array<{ __typename?: 'SubgenreDistribution', subgenre: string, count: number }>, yearDistribution: Array<{ __typename?: 'YearDistribution', year?: number | null, count?: number | null }>, formatDistribution: Array<{ __typename?: 'FormatDistribution', format: string, count: number }>, listeningStats: { __typename?: 'ListeningStats', totalPlays: number, totalPlayTime: number, averageConfidence: number, favoriteCount: number }, topArtists: Array<{ __typename?: 'TopArtist', artist: string, trackCount: number, totalDuration: number, averageConfidence: number }>, topGenres: Array<{ __typename?: 'TopGenre', genre: string, trackCount: number, averageConfidence: number, averageDuration: number }>, recentActivity: Array<{ __typename?: 'RecentActivity', date: string, tracksAdded: number, tracksAnalyzed: number }> } };

export type GetPlaybackStateQueryVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type GetPlaybackStateQuery = { __typename?: 'Query', getPlaybackState?: { __typename?: 'PlaybackState', trackId: string, isPlaying: boolean, currentTime: number, duration: number, volume: number, playbackRate: number, isFavorite: boolean } | null };

export type GetWaveformDataQueryVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type GetWaveformDataQuery = { __typename?: 'Query', getWaveformData: Array<number> };

export type GetDetailedWaveformDataQueryVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type GetDetailedWaveformDataQuery = { __typename?: 'Query', getDetailedWaveformData: { __typename?: 'WaveformData', peaks: Array<number>, duration: number, sampleRate: number, channels: number, bitDepth: number } };

export type GetAudioAnalysisQueryVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type GetAudioAnalysisQuery = { __typename?: 'Query', getAudioAnalysis: { __typename?: 'AudioAnalysisResult', tempo: number, key: string, mode: string, danceability: number, valence: number, acousticness: number, instrumentalness: number, liveness: number, speechiness: number, duration: number, analysisVersion: string, beats: Array<{ __typename?: 'BeatData', timestamp: number, confidence: number, strength: number }>, energy: Array<{ __typename?: 'EnergyData', timestamp: number, energy: number, frequency: number }> } };

export type GetBeatDataQueryVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type GetBeatDataQuery = { __typename?: 'Query', getBeatData: Array<{ __typename?: 'BeatData', timestamp: number, confidence: number, strength: number }> };

export type GetEnergyDataQueryVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type GetEnergyDataQuery = { __typename?: 'Query', getEnergyData: Array<{ __typename?: 'EnergyData', timestamp: number, energy: number, frequency: number }> };

export type GetRealTimeAnalysisQueryVariables = Exact<{
  trackId: Scalars['String']['input'];
  currentTime: Scalars['Float']['input'];
}>;


export type GetRealTimeAnalysisQuery = { __typename?: 'Query', getRealTimeAnalysis: { __typename?: 'RealTimeAnalysis', currentEnergy: number, beatConfidence: number, nextBeatEstimate: number, energyTrend: string, currentBeat: { __typename?: 'BeatData', timestamp: number, confidence: number, strength: number } } };

export type GetAudioInfoQueryVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type GetAudioInfoQuery = { __typename?: 'Query', getAudioInfo: { __typename?: 'AudioInfo', trackId: string, fileName: string, fileSize: number, duration: number, format: string, bitrate?: number | null, sampleRate?: number | null, contentType: string } };

export type GetAudioStreamUrlQueryVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type GetAudioStreamUrlQuery = { __typename?: 'Query', getAudioStreamUrl: string };

export type PlayTrackMutationVariables = Exact<{
  trackId: Scalars['String']['input'];
  startTime?: InputMaybe<Scalars['Float']['input']>;
}>;


export type PlayTrackMutation = { __typename?: 'Mutation', playTrack: { __typename?: 'PlaybackState', trackId: string, isPlaying: boolean, currentTime: number, duration: number, volume: number, playbackRate: number, isFavorite: boolean } };

export type PauseTrackMutationVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type PauseTrackMutation = { __typename?: 'Mutation', pauseTrack: { __typename?: 'PlaybackState', trackId: string, isPlaying: boolean, currentTime: number, duration: number, volume: number, playbackRate: number, isFavorite: boolean } };

export type ResumeTrackMutationVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type ResumeTrackMutation = { __typename?: 'Mutation', resumeTrack: { __typename?: 'PlaybackState', trackId: string, isPlaying: boolean, currentTime: number, duration: number, volume: number, playbackRate: number, isFavorite: boolean } };

export type SeekTrackMutationVariables = Exact<{
  trackId: Scalars['String']['input'];
  timeInSeconds: Scalars['Float']['input'];
}>;


export type SeekTrackMutation = { __typename?: 'Mutation', seekTrack: { __typename?: 'PlaybackState', trackId: string, isPlaying: boolean, currentTime: number, duration: number, volume: number, playbackRate: number, isFavorite: boolean } };

export type StopTrackMutationVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type StopTrackMutation = { __typename?: 'Mutation', stopTrack: boolean };

export type SetVolumeMutationVariables = Exact<{
  trackId: Scalars['String']['input'];
  volume: Scalars['Float']['input'];
}>;


export type SetVolumeMutation = { __typename?: 'Mutation', setVolume: { __typename?: 'PlaybackState', trackId: string, isPlaying: boolean, currentTime: number, duration: number, volume: number, playbackRate: number, isFavorite: boolean } };

export type SetPlaybackRateMutationVariables = Exact<{
  trackId: Scalars['String']['input'];
  rate: Scalars['Float']['input'];
}>;


export type SetPlaybackRateMutation = { __typename?: 'Mutation', setPlaybackRate: { __typename?: 'PlaybackState', trackId: string, isPlaying: boolean, currentTime: number, duration: number, volume: number, playbackRate: number, isFavorite: boolean } };

export type ToggleFavoriteMutationVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type ToggleFavoriteMutation = { __typename?: 'Mutation', toggleFavorite: { __typename?: 'MusicTrack', id: string, isFavorite: boolean, updatedAt: any } };

export type SimpleMusicTrackFragmentFragment = { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null };

export type GetPlaylistsQueryVariables = Exact<{
  userId: Scalars['String']['input'];
}>;


export type GetPlaylistsQuery = { __typename?: 'Query', playlists: Array<{ __typename?: 'PlaylistItem', id: string, name: string, description: string, genresCount: number, subgenresCount: number, topGenres: Array<string>, topSubgenres: Array<string>, numberOfTracks: number, totalDuration: number, createdAt: any, updatedAt: any, images: Array<string>, bpmRange: { __typename?: 'Range', min: number, max: number }, energyRange: { __typename?: 'Range', min: number, max: number } }> };

export type GetPlaylistQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
}>;


export type GetPlaylistQuery = { __typename?: 'Query', playlist: { __typename?: 'Playlist', id: string, name: string, description: string, genresCount: number, subgenresCount: number, topGenres: Array<string>, topSubgenres: Array<string>, numberOfTracks: number, totalDuration: number, createdAt: any, updatedAt: any, images: Array<string>, bpmRange: { __typename?: 'Range', min: number, max: number }, energyRange: { __typename?: 'Range', min: number, max: number }, tracks: Array<{ __typename?: 'PlaylistTrack', id: string, position: number, addedAt: string, track: { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null } }> } };

export type GetPlaylistByNameQueryVariables = Exact<{
  name: Scalars['String']['input'];
}>;


export type GetPlaylistByNameQuery = { __typename?: 'Query', playlistByName: { __typename?: 'Playlist', id: string, name: string, description: string, genresCount: number, subgenresCount: number, topGenres: Array<string>, topSubgenres: Array<string>, numberOfTracks: number, totalDuration: number, createdAt: any, updatedAt: any, images: Array<string>, bpmRange: { __typename?: 'Range', min: number, max: number }, energyRange: { __typename?: 'Range', min: number, max: number }, tracks: Array<{ __typename?: 'PlaylistTrack', id: string, position: number, addedAt: string, track: { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null } }> } };

export type CreatePlaylistMutationVariables = Exact<{
  input: CreatePlaylistInput;
}>;


export type CreatePlaylistMutation = { __typename?: 'Mutation', createPlaylist: { __typename?: 'Playlist', id: string, name: string, description: string, createdAt: any, updatedAt: any } };

export type UpdatePlaylistMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdatePlaylistInput;
  userId: Scalars['String']['input'];
}>;


export type UpdatePlaylistMutation = { __typename?: 'Mutation', updatePlaylist: { __typename?: 'Playlist', id: string, name: string, description: string, createdAt: any, updatedAt: any } };

export type DeletePlaylistMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
}>;


export type DeletePlaylistMutation = { __typename?: 'Mutation', deletePlaylist: boolean };

export type AddTrackToPlaylistMutationVariables = Exact<{
  playlistId: Scalars['ID']['input'];
  input: AddTrackToPlaylistInput;
  userId: Scalars['String']['input'];
}>;


export type AddTrackToPlaylistMutation = { __typename?: 'Mutation', addTrackToPlaylist: { __typename?: 'PlaylistTrack', id: string, position: number, addedAt: string, track: { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null } } };

export type RemoveTrackFromPlaylistMutationVariables = Exact<{
  playlistId: Scalars['ID']['input'];
  trackId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
}>;


export type RemoveTrackFromPlaylistMutation = { __typename?: 'Mutation', removeTrackFromPlaylist: boolean };

export type GetPlaylistRecommendationsQueryVariables = Exact<{
  playlistId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  excludeTrackIds?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
}>;


export type GetPlaylistRecommendationsQuery = { __typename?: 'Query', playlistRecommendations: Array<{ __typename?: 'TrackRecommendation', similarity: number, reasons: Array<string>, track: { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null } }> };
