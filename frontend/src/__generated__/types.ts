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
  Base64ID: { input: any; output: any; }
  DateTime: { input: any; output: any; }
};

export type AddTrackToPlaylistInput = {
  position?: InputMaybe<Scalars['Int']['input']>;
  trackId: Scalars['Base64ID']['input'];
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

export type CleanArchPlaylist = Node & {
  __typename?: 'CleanArchPlaylist';
  /** True if the given track is already in this playlist */
  containsTrack?: Maybe<Scalars['Boolean']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdById: Scalars['Base64ID']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['Base64ID']['output'];
  isPublic: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  recommendations?: Maybe<Array<TrackRecommendation>>;
  sorting?: Maybe<CleanArchPlaylistSorting>;
  stats?: Maybe<CleanArchPlaylistStats>;
  tracks?: Maybe<Array<CleanArchPlaylistTrack>>;
  updatedAt: Scalars['DateTime']['output'];
  updatedById?: Maybe<Scalars['Base64ID']['output']>;
};


export type CleanArchPlaylistContainsTrackArgs = {
  trackId?: InputMaybe<Scalars['Base64ID']['input']>;
};


export type CleanArchPlaylistRecommendationsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type CleanArchPlaylistSorting = {
  __typename?: 'CleanArchPlaylistSorting';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['Base64ID']['output'];
  playlistId: Scalars['Base64ID']['output'];
  sortingDirection: Scalars['String']['output'];
  sortingKey: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type CleanArchPlaylistStats = {
  __typename?: 'CleanArchPlaylistStats';
  bpmRange: Range;
  energyRange: Range;
  genresCount: Scalars['Int']['output'];
  images: Array<Scalars['String']['output']>;
  numberOfTracks: Scalars['Int']['output'];
  subgenresCount: Scalars['Int']['output'];
  topGenres: Array<Scalars['String']['output']>;
  topSubgenres: Array<Scalars['String']['output']>;
  totalDuration: Scalars['Float']['output'];
};

export type CleanArchPlaylistTrack = {
  __typename?: 'CleanArchPlaylistTrack';
  addedAt: Scalars['DateTime']['output'];
  id: Scalars['Base64ID']['output'];
  playlistId: Scalars['Base64ID']['output'];
  position: Scalars['Int']['output'];
  track?: Maybe<Track>;
  trackId: Scalars['Base64ID']['output'];
};

export type CleanArchUpdatePlaylistInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
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
  filters?: InputMaybe<PlaylistFilterInput>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  maxTracks?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  subgenreSelectionMode?: InputMaybe<Scalars['String']['input']>;
};

export type FilterCriteriaInput = {
  acousticness?: InputMaybe<RangeInput>;
  arousalMood?: InputMaybe<Array<Scalars['String']['input']>>;
  artist?: InputMaybe<Scalars['String']['input']>;
  atmosphereIds?: InputMaybe<Array<Scalars['String']['input']>>;
  danceabilityFeeling?: InputMaybe<Array<Scalars['String']['input']>>;
  genreIds?: InputMaybe<Array<Scalars['Base64ID']['input']>>;
  instrumentalness?: InputMaybe<RangeInput>;
  keyIds?: InputMaybe<Array<Scalars['String']['input']>>;
  libraryIds?: InputMaybe<Array<Scalars['Base64ID']['input']>>;
  liveness?: InputMaybe<RangeInput>;
  speechiness?: InputMaybe<RangeInput>;
  subgenreIds?: InputMaybe<Array<Scalars['Base64ID']['input']>>;
  tempo?: InputMaybe<RangeInput>;
  title?: InputMaybe<Scalars['String']['input']>;
  valenceMood?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type FilterCriteriaResult = {
  __typename?: 'FilterCriteriaResult';
  criteria: FilterCriteriaType;
  id: Scalars['Base64ID']['output'];
  name: Scalars['String']['output'];
};

export type FilterCriteriaType = {
  __typename?: 'FilterCriteriaType';
  acousticness?: Maybe<Range>;
  arousalMood?: Maybe<Array<Scalars['String']['output']>>;
  artist?: Maybe<Scalars['String']['output']>;
  atmosphereIds?: Maybe<Array<Scalars['String']['output']>>;
  danceabilityFeeling?: Maybe<Array<Scalars['String']['output']>>;
  genreIds?: Maybe<Array<Scalars['Base64ID']['output']>>;
  instrumentalness?: Maybe<Range>;
  keyIds?: Maybe<Array<Scalars['String']['output']>>;
  libraryIds?: Maybe<Array<Scalars['Base64ID']['output']>>;
  liveness?: Maybe<Range>;
  speechiness?: Maybe<Range>;
  subgenreIds?: Maybe<Array<Scalars['Base64ID']['output']>>;
  tempo?: Maybe<Range>;
  title?: Maybe<Scalars['String']['output']>;
  valenceMood?: Maybe<Array<Scalars['String']['output']>>;
};

export type FilterWithId = {
  __typename?: 'FilterWithID';
  id: Scalars['Base64ID']['output'];
  name: Scalars['String']['output'];
};

export type HomeMetrics = {
  __typename?: 'HomeMetrics';
  artistCount: Scalars['Int']['output'];
  listeningStats: ListeningStats;
  recentActivity: Array<RecentActivity>;
  topArtists: Array<TopArtist>;
  topGenres: Array<TopGenre>;
  totalListeningTime: Scalars['Float']['output'];
  totalTracks: Scalars['Int']['output'];
};

export type ImageSearch = {
  __typename?: 'ImageSearch';
  id: Scalars['ID']['output'];
  imagePath: Scalars['String']['output'];
  imageUrl: Scalars['String']['output'];
  source: Scalars['String']['output'];
};

export type Library = Node & {
  __typename?: 'Library';
  analyzedTracks: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  failedTracks: Scalars['Float']['output'];
  id: Scalars['Base64ID']['output'];
  lastIncrementalScanAt?: Maybe<Scalars['DateTime']['output']>;
  lastScanAt?: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  pendingTracks: Scalars['Float']['output'];
  rootPath: Scalars['String']['output'];
  scanStatus: Scalars['String']['output'];
  settings: LibrarySettings;
  totalTracks: Scalars['Float']['output'];
  updatedAt: Scalars['DateTime']['output'];
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
  supportedFormats: Scalars['String']['output'];
};

export type ListeningStats = {
  __typename?: 'ListeningStats';
  favoriteCount: Scalars['Int']['output'];
  totalPlayTime: Scalars['Float']['output'];
  totalPlays: Scalars['Int']['output'];
};

export type MusicPlayer = {
  __typename?: 'MusicPlayer';
  currentWaveformData?: Maybe<Array<Scalars['Float']['output']>>;
};


export type MusicPlayerCurrentWaveformDataArgs = {
  trackId: Scalars['Base64ID']['input'];
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
  analysisStartedAt?: Maybe<Scalars['DateTime']['output']>;
  analysisStatus: Scalars['String']['output'];
  audioFingerprint?: Maybe<AudioFingerprint>;
  bitrate?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  duration: Scalars['Float']['output'];
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

export type MusicTrackListPaginated = {
  __typename?: 'MusicTrackListPaginated';
  limit: Scalars['Float']['output'];
  page: Scalars['Float']['output'];
  total: Scalars['Float']['output'];
  tracks: Array<SimpleMusicTrack>;
};

export type Mutation = {
  __typename?: 'Mutation';
  addTrackToPlaylist: CleanArchPlaylistTrack;
  addTrackToQueue: QueueItem;
  addTracksToQueue: Array<QueueItem>;
  authenticateSpotify: SpotifyAuthResult;
  authenticateTidal: TidalAuthResult;
  authenticateYouTube: YouTubeAuthResult;
  bangerTrack: SimpleMusicTrack;
  caUpdatePlaylist: CleanArchPlaylist;
  createLibrary: Library;
  createPlaylist: CleanArchPlaylist;
  createSavedFilter: FilterCriteriaResult;
  deleteLibrary: Scalars['Boolean']['output'];
  deletePlaylist: Scalars['Boolean']['output'];
  deleteSavedFilter: Scalars['Boolean']['output'];
  dislikeTrack: Scalars['Boolean']['output'];
  exportPlaylistToM3U: Scalars['String']['output'];
  likeTrack: SimpleMusicTrack;
  removeTrackFromPlaylist: Scalars['Boolean']['output'];
  removeTrackFromQueue: RemoveTrackFromQueueResponse;
  resetQueue: Scalars['Boolean']['output'];
  startLibraryScan: LibraryScanResult;
  stopLibraryScan: Scalars['Boolean']['output'];
  syncPlaylistToSpotify: SyncResult;
  syncPlaylistToTidal: SyncResult;
  syncPlaylistToYouTube: SyncResult;
  toggleFavorite: MusicTrack;
  updatePlaylistSorting: CleanArchPlaylistSorting;
  updatePlaylistTracksPositions: Scalars['Boolean']['output'];
  updateQueuePositions: Array<QueueItem>;
  updateSavedFilter: FilterCriteriaResult;
};


export type MutationAddTrackToPlaylistArgs = {
  input: AddTrackToPlaylistInput;
  playlistId: Scalars['Base64ID']['input'];
};


export type MutationAddTrackToQueueArgs = {
  trackId: Scalars['Base64ID']['input'];
};


export type MutationAddTracksToQueueArgs = {
  trackIds: Array<Scalars['Base64ID']['input']>;
};


export type MutationAuthenticateSpotifyArgs = {
  code: Scalars['String']['input'];
  codeVerifier: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};


export type MutationAuthenticateTidalArgs = {
  code: Scalars['String']['input'];
  codeVerifier: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};


export type MutationAuthenticateYouTubeArgs = {
  code: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};


export type MutationBangerTrackArgs = {
  trackId: Scalars['ID']['input'];
};


export type MutationCaUpdatePlaylistArgs = {
  id: Scalars['Base64ID']['input'];
  input: CleanArchUpdatePlaylistInput;
};


export type MutationCreateLibraryArgs = {
  input: CreateLibraryInput;
};


export type MutationCreatePlaylistArgs = {
  input: CreatePlaylistInput;
};


export type MutationCreateSavedFilterArgs = {
  input: SavedFilterInput;
};


export type MutationDeleteLibraryArgs = {
  id: Scalars['Base64ID']['input'];
};


export type MutationDeletePlaylistArgs = {
  id: Scalars['Base64ID']['input'];
};


export type MutationDeleteSavedFilterArgs = {
  id: Scalars['Base64ID']['input'];
};


export type MutationDislikeTrackArgs = {
  trackId: Scalars['ID']['input'];
};


export type MutationExportPlaylistToM3UArgs = {
  playlistId: Scalars['Base64ID']['input'];
};


export type MutationLikeTrackArgs = {
  trackId: Scalars['ID']['input'];
};


export type MutationRemoveTrackFromPlaylistArgs = {
  playlistId: Scalars['Base64ID']['input'];
  trackId: Scalars['Base64ID']['input'];
};


export type MutationRemoveTrackFromQueueArgs = {
  trackId: Scalars['Base64ID']['input'];
};


export type MutationStartLibraryScanArgs = {
  incremental?: InputMaybe<Scalars['Boolean']['input']>;
  libraryId: Scalars['ID']['input'];
};


export type MutationStopLibraryScanArgs = {
  libraryId: Scalars['ID']['input'];
};


export type MutationSyncPlaylistToSpotifyArgs = {
  playlistId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
};


export type MutationSyncPlaylistToTidalArgs = {
  playlistId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
};


export type MutationSyncPlaylistToYouTubeArgs = {
  playlistId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
};


export type MutationToggleFavoriteArgs = {
  trackId: Scalars['String']['input'];
};


export type MutationUpdatePlaylistSortingArgs = {
  input: UpdatePlaylistSortingInput;
  playlistId: Scalars['Base64ID']['input'];
};


export type MutationUpdatePlaylistTracksPositionsArgs = {
  input: UpdatePlaylistPositionsInput;
  playlistId: Scalars['Base64ID']['input'];
};


export type MutationUpdateQueuePositionsArgs = {
  input: UpdateQueuePositionsInput;
};


export type MutationUpdateSavedFilterArgs = {
  id: Scalars['Base64ID']['input'];
  input: SavedFilterInput;
};

export type Node = {
  id: Scalars['Base64ID']['output'];
};

export type PlaylistFilterInput = {
  atmospheres?: InputMaybe<Array<Scalars['String']['input']>>;
  genreIds?: InputMaybe<Array<Scalars['Base64ID']['input']>>;
  libraryIds?: InputMaybe<Array<Scalars['Base64ID']['input']>>;
  subgenreIds?: InputMaybe<Array<Scalars['Base64ID']['input']>>;
  tempo?: InputMaybe<RangeInput>;
};

export type PlaylistsResult = {
  __typename?: 'PlaylistsResult';
  items: Array<CleanArchPlaylist>;
};

export type Query = {
  __typename?: 'Query';
  favoritePlaylist: CleanArchPlaylist;
  getSpotifyAuthUrl: SpotifyAuthUrl;
  getTidalAuthUrl: TidalAuthUrl;
  getYouTubeAuthUrl: YouTubeAuthUrl;
  me: User;
  /** Fetch any node by global ID. Use inline fragments (... on CleanArchPlaylist { ... }) to request fields. */
  node?: Maybe<Node>;
  randomTrackWithStats: RandomTrackWithStats;
  recentlyPlayed: Array<SimpleMusicTrack>;
  tracks: Array<SimpleMusicTrack>;
  tracksList: MusicTrackListPaginated;
};


export type QueryNodeArgs = {
  id: Scalars['Base64ID']['input'];
};


export type QueryRecentlyPlayedArgs = {
  limit?: Scalars['Float']['input'];
};


export type QueryTracksArgs = {
  options?: InputMaybe<TrackQueryOptions>;
};


export type QueryTracksListArgs = {
  options?: InputMaybe<TrackQueryOptions>;
};

export type QueueItem = {
  __typename?: 'QueueItem';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['Base64ID']['output'];
  position: Scalars['Int']['output'];
  track?: Maybe<Track>;
  trackId: Scalars['Base64ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type RandomTrackWithStats = {
  __typename?: 'RandomTrackWithStats';
  bangerCount: Scalars['Float']['output'];
  dislikedCount: Scalars['Float']['output'];
  likedCount: Scalars['Float']['output'];
  remainingCount: Scalars['Float']['output'];
  track?: Maybe<SimpleMusicTrack>;
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

export type RecentActivity = {
  __typename?: 'RecentActivity';
  date: Scalars['String']['output'];
  tracksAdded: Scalars['Int']['output'];
  tracksAnalyzed: Scalars['Int']['output'];
};

export type RemoveTrackFromQueueResponse = {
  __typename?: 'RemoveTrackFromQueueResponse';
  artist?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  title?: Maybe<Scalars['String']['output']>;
  trackId: Scalars['Base64ID']['output'];
};

export type SavedFilterInput = {
  criteria: FilterCriteriaInput;
  isCurrent?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
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
  fileCreatedAt?: Maybe<Scalars['DateTime']['output']>;
  format?: Maybe<Scalars['String']['output']>;
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
  libraryId?: Maybe<Scalars['String']['output']>;
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

export type SpotifyAuthResult = {
  __typename?: 'SpotifyAuthResult';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type SpotifyAuthUrl = {
  __typename?: 'SpotifyAuthUrl';
  authUrl: Scalars['String']['output'];
  codeVerifier: Scalars['String']['output'];
};

export type StaticFilterOptions = {
  __typename?: 'StaticFilterOptions';
  atmospheres: Array<FilterWithId>;
  genres: Array<FilterWithId>;
  keys: Array<FilterWithId>;
  libraries: Array<FilterWithId>;
  subgenres: Array<FilterWithId>;
};

export type SyncResult = {
  __typename?: 'SyncResult';
  errors: Array<Scalars['String']['output']>;
  playlistId?: Maybe<Scalars['String']['output']>;
  playlistUrl?: Maybe<Scalars['String']['output']>;
  skippedCount: Scalars['Float']['output'];
  success: Scalars['Boolean']['output'];
  syncedCount: Scalars['Float']['output'];
};

export type TidalAuthResult = {
  __typename?: 'TidalAuthResult';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type TidalAuthUrl = {
  __typename?: 'TidalAuthUrl';
  authUrl: Scalars['String']['output'];
  codeVerifier: Scalars['String']['output'];
};

export type TopArtist = {
  __typename?: 'TopArtist';
  artist: Scalars['String']['output'];
  totalDuration: Scalars['Float']['output'];
  trackCount: Scalars['Int']['output'];
};

export type TopGenre = {
  __typename?: 'TopGenre';
  genre: Scalars['String']['output'];
  trackCount: Scalars['Int']['output'];
};

export type Track = Node & {
  __typename?: 'Track';
  aiMetadata: TrackAiMetadata;
  artist?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  fileInfo: TrackFileInfo;
  id: Scalars['Base64ID']['output'];
  imagePath?: Maybe<Scalars['String']['output']>;
  lastScannedAt?: Maybe<Scalars['DateTime']['output']>;
  libraryId?: Maybe<Scalars['String']['output']>;
  metadata: TrackMetadata;
  musicalFeatures: TrackMusicalFeatures;
  recommendations: Array<TrackRecommendation>;
  stats: TrackStats;
  technicalInfo: TrackTechnicalInfo;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type TrackRecommendationsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type TrackAiMetadata = {
  __typename?: 'TrackAIMetadata';
  atmosphereKeywords?: Maybe<Array<Scalars['String']['output']>>;
  contextBackgrounds?: Maybe<Scalars['String']['output']>;
  contextImpacts?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  vocalsDesc?: Maybe<Scalars['String']['output']>;
  vocalsDescriptions?: Maybe<Scalars['String']['output']>;
};

export type TrackFileInfo = {
  __typename?: 'TrackFileInfo';
  fileCreatedAt: Scalars['DateTime']['output'];
  fileName: Scalars['String']['output'];
  filePath: Scalars['String']['output'];
  fileSize: Scalars['Float']['output'];
};

export type TrackMetadata = {
  __typename?: 'TrackMetadata';
  album?: Maybe<Scalars['String']['output']>;
  date?: Maybe<Scalars['DateTime']['output']>;
  genres?: Maybe<Array<Scalars['String']['output']>>;
  subgenres?: Maybe<Array<Scalars['String']['output']>>;
};

export type TrackMusicalFeatures = {
  __typename?: 'TrackMusicalFeatures';
  acousticness?: Maybe<Scalars['Float']['output']>;
  arousalMood?: Maybe<Scalars['String']['output']>;
  danceabilityFeeling?: Maybe<Scalars['String']['output']>;
  instrumentalness?: Maybe<Scalars['Float']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  speechiness?: Maybe<Scalars['Float']['output']>;
  tempo?: Maybe<Scalars['Float']['output']>;
  valenceMood?: Maybe<Scalars['String']['output']>;
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

export type TrackRecommendation = {
  __typename?: 'TrackRecommendation';
  reasons: Array<Scalars['String']['output']>;
  similarity: Scalars['Float']['output'];
  track: Track;
};

export type TrackStats = {
  __typename?: 'TrackStats';
  isBanger: Scalars['Boolean']['output'];
  isFavorite: Scalars['Boolean']['output'];
  isLiked: Scalars['Boolean']['output'];
  lastPlayedAt?: Maybe<Scalars['DateTime']['output']>;
  listeningCount: Scalars['Float']['output'];
};

export type TrackTechnicalInfo = {
  __typename?: 'TrackTechnicalInfo';
  duration: Scalars['Float']['output'];
  format: Scalars['String']['output'];
};

export type UpdatePlaylistPositionInput = {
  id: Scalars['Base64ID']['input'];
  position: Scalars['Int']['input'];
};

export type UpdatePlaylistPositionsInput = {
  positions: Array<UpdatePlaylistPositionInput>;
};

export type UpdatePlaylistSortingInput = {
  sortingDirection: Scalars['String']['input'];
  sortingKey: Scalars['String']['input'];
};

export type UpdateQueuePositionInput = {
  position: Scalars['Int']['input'];
  trackId: Scalars['Base64ID']['input'];
};

export type UpdateQueuePositionsInput = {
  positions: Array<UpdateQueuePositionInput>;
};

export type User = Node & {
  __typename?: 'User';
  activeFilters: Array<FilterCriteriaResult>;
  currentFilter?: Maybe<FilterCriteriaResult>;
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  homeMetrics: HomeMetrics;
  id: Scalars['Base64ID']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  libraries: Array<Library>;
  musicPlayer: MusicPlayer;
  playlists: PlaylistsResult;
  queue: Array<QueueItem>;
  randomTrackId: Scalars['Base64ID']['output'];
  staticFilterOptions: StaticFilterOptions;
  tracks: Array<Track>;
};


export type UserTracksArgs = {
  id?: InputMaybe<Scalars['Base64ID']['input']>;
};

export type YouTubeAuthResult = {
  __typename?: 'YouTubeAuthResult';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type YouTubeAuthUrl = {
  __typename?: 'YouTubeAuthUrl';
  authUrl: Scalars['String']['output'];
};

export type GetLibrariesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetLibrariesQuery = { __typename?: 'Query', me: { __typename?: 'User', libraries: Array<{ __typename?: 'Library', id: any, name: string, rootPath: string, totalTracks: number, analyzedTracks: number, pendingTracks: number, failedTracks: number, lastScanAt?: any | null, lastIncrementalScanAt?: any | null, scanStatus: string, createdAt: any, updatedAt: any, settings: { __typename?: 'LibrarySettings', autoScan: boolean, includeSubdirectories: boolean, supportedFormats: string, maxFileSize?: number | null, scanInterval?: number | null } }> } };

export type GetLibraryQueryVariables = Exact<{
  id: Scalars['Base64ID']['input'];
}>;


export type GetLibraryQuery = { __typename?: 'Query', node?:
    | { __typename?: 'CleanArchPlaylist' }
    | { __typename?: 'Library', id: any, name: string, rootPath: string, totalTracks: number, analyzedTracks: number, pendingTracks: number, failedTracks: number, lastScanAt?: any | null, lastIncrementalScanAt?: any | null, scanStatus: string, createdAt: any, updatedAt: any, settings: { __typename?: 'LibrarySettings', autoScan: boolean, includeSubdirectories: boolean, supportedFormats: string, maxFileSize?: number | null, scanInterval?: number | null } }
    | { __typename?: 'Track' }
    | { __typename?: 'User' }
   | null };

export type GetTracksQueryVariables = Exact<{
  options?: InputMaybe<TrackQueryOptions>;
}>;


export type GetTracksQuery = { __typename?: 'Query', tracks: Array<{ __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, format?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, fileCreatedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null, libraryId?: string | null }> };

export type GetRandomTrackQueryVariables = Exact<{
  id: Scalars['Base64ID']['input'];
}>;


export type GetRandomTrackQuery = { __typename?: 'Query', node?:
    | { __typename?: 'CleanArchPlaylist' }
    | { __typename?: 'Library' }
    | { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } }
    | { __typename?: 'User' }
   | null };

export type GetRandomTrackWithStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRandomTrackWithStatsQuery = { __typename?: 'Query', randomTrackWithStats: { __typename?: 'RandomTrackWithStats', likedCount: number, bangerCount: number, dislikedCount: number, remainingCount: number, track?: { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, format?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, fileCreatedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null, libraryId?: string | null } | null } };

export type GetTrackRecommendationsQueryVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
  recommendationsLimit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetTrackRecommendationsQuery = { __typename?: 'Query', node?:
    | { __typename?: 'CleanArchPlaylist' }
    | { __typename?: 'Library' }
    | { __typename?: 'Track', recommendations: Array<{ __typename?: 'TrackRecommendation', similarity: number, reasons: Array<string>, track: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } } }> }
    | { __typename?: 'User' }
   | null };

export type GetTracksListQueryVariables = Exact<{
  options?: InputMaybe<TrackQueryOptions>;
}>;


export type GetTracksListQuery = { __typename?: 'Query', tracksList: { __typename?: 'MusicTrackListPaginated', total: number, page: number, limit: number, tracks: Array<{ __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, format?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, fileCreatedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null, libraryId?: string | null }> } };

export type GetStaticFiltersQueryVariables = Exact<{ [key: string]: never; }>;


export type GetStaticFiltersQuery = { __typename?: 'Query', me: { __typename?: 'User', staticFilterOptions: { __typename?: 'StaticFilterOptions', genres: Array<{ __typename?: 'FilterWithID', id: any, name: string }>, subgenres: Array<{ __typename?: 'FilterWithID', id: any, name: string }>, keys: Array<{ __typename?: 'FilterWithID', id: any, name: string }>, libraries: Array<{ __typename?: 'FilterWithID', id: any, name: string }>, atmospheres: Array<{ __typename?: 'FilterWithID', id: any, name: string }> } } };

export type GetRecentlyPlayedQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Float']['input']>;
}>;


export type GetRecentlyPlayedQuery = { __typename?: 'Query', recentlyPlayed: Array<{ __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, format?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, fileCreatedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null, libraryId?: string | null }> };

export type LikeTrackMutationVariables = Exact<{
  trackId: Scalars['ID']['input'];
}>;


export type LikeTrackMutation = { __typename?: 'Mutation', likeTrack: { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, format?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, fileCreatedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null, libraryId?: string | null } };

export type BangerTrackMutationVariables = Exact<{
  trackId: Scalars['ID']['input'];
}>;


export type BangerTrackMutation = { __typename?: 'Mutation', bangerTrack: { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, format?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, fileCreatedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null, libraryId?: string | null } };

export type DislikeTrackMutationVariables = Exact<{
  trackId: Scalars['ID']['input'];
}>;


export type DislikeTrackMutation = { __typename?: 'Mutation', dislikeTrack: boolean };

export type ActiveFiltersQueryVariables = Exact<{ [key: string]: never; }>;


export type ActiveFiltersQuery = { __typename?: 'Query', me: { __typename?: 'User', activeFilters: Array<{ __typename?: 'FilterCriteriaResult', id: any, name: string, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genreIds?: Array<any> | null, keyIds?: Array<string> | null, subgenreIds?: Array<any> | null, artist?: string | null, title?: string | null, libraryIds?: Array<any> | null, atmosphereIds?: Array<string> | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, speechiness?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null, liveness?: { __typename?: 'Range', max: number, min: number } | null, acousticness?: { __typename?: 'Range', max: number, min: number } | null } }> } };

export type GetCurrentFilterQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCurrentFilterQuery = { __typename?: 'Query', me: { __typename?: 'User', currentFilter?: { __typename?: 'FilterCriteriaResult', id: any, name: string, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genreIds?: Array<any> | null, keyIds?: Array<string> | null, subgenreIds?: Array<any> | null, artist?: string | null, title?: string | null, libraryIds?: Array<any> | null, atmosphereIds?: Array<string> | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, speechiness?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null, liveness?: { __typename?: 'Range', max: number, min: number } | null, acousticness?: { __typename?: 'Range', max: number, min: number } | null } } | null } };

export type CreateFilterMutationVariables = Exact<{
  input: SavedFilterInput;
}>;


export type CreateFilterMutation = { __typename?: 'Mutation', createSavedFilter: { __typename?: 'FilterCriteriaResult', id: any, name: string, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genreIds?: Array<any> | null, keyIds?: Array<string> | null, subgenreIds?: Array<any> | null, artist?: string | null, title?: string | null, libraryIds?: Array<any> | null, atmosphereIds?: Array<string> | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, speechiness?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null, liveness?: { __typename?: 'Range', max: number, min: number } | null, acousticness?: { __typename?: 'Range', max: number, min: number } | null } } };

export type UpdateFilterMutationVariables = Exact<{
  id: Scalars['Base64ID']['input'];
  input: SavedFilterInput;
}>;


export type UpdateFilterMutation = { __typename?: 'Mutation', updateSavedFilter: { __typename?: 'FilterCriteriaResult', id: any, name: string, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genreIds?: Array<any> | null, keyIds?: Array<string> | null, subgenreIds?: Array<any> | null, artist?: string | null, title?: string | null, libraryIds?: Array<any> | null, atmosphereIds?: Array<string> | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, speechiness?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null, liveness?: { __typename?: 'Range', max: number, min: number } | null, acousticness?: { __typename?: 'Range', max: number, min: number } | null } } };

export type DeleteActiveFilterMutationVariables = Exact<{
  id: Scalars['Base64ID']['input'];
}>;


export type DeleteActiveFilterMutation = { __typename?: 'Mutation', deleteSavedFilter: boolean };

export type TrackFragmentFragment = { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } };

export type PlaylistTrackFragmentFragment = { __typename?: 'CleanArchPlaylistTrack', id: any, position: number, addedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } } | null };

export type PlaylistFragmentFragment = { __typename?: 'CleanArchPlaylist', id: any, name: string, description?: string | null, isPublic: boolean, createdAt: any, updatedAt: any, createdById: any, updatedById?: any | null, stats?: { __typename?: 'CleanArchPlaylistStats', genresCount: number, numberOfTracks: number, subgenresCount: number, topGenres: Array<string>, topSubgenres: Array<string>, totalDuration: number, images: Array<string>, bpmRange: { __typename?: 'Range', min: number, max: number }, energyRange: { __typename?: 'Range', min: number, max: number } } | null, sorting?: { __typename?: 'CleanArchPlaylistSorting', id: any, playlistId: any, sortingKey: string, sortingDirection: string, createdAt: any, updatedAt: any } | null, tracks?: Array<{ __typename?: 'CleanArchPlaylistTrack', id: any, position: number, addedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } } | null }> | null };

export type FilterFragmentFragment = { __typename?: 'FilterCriteriaResult', id: any, name: string, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genreIds?: Array<any> | null, keyIds?: Array<string> | null, subgenreIds?: Array<any> | null, artist?: string | null, title?: string | null, libraryIds?: Array<any> | null, atmosphereIds?: Array<string> | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, speechiness?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null, liveness?: { __typename?: 'Range', max: number, min: number } | null, acousticness?: { __typename?: 'Range', max: number, min: number } | null } };

export type LibraryFragmentFragment = { __typename?: 'Library', id: any, name: string, rootPath: string, totalTracks: number, analyzedTracks: number, pendingTracks: number, failedTracks: number, lastScanAt?: any | null, lastIncrementalScanAt?: any | null, scanStatus: string, createdAt: any, updatedAt: any, settings: { __typename?: 'LibrarySettings', autoScan: boolean, includeSubdirectories: boolean, supportedFormats: string, maxFileSize?: number | null, scanInterval?: number | null } };

export type HomeMetricsQueryVariables = Exact<{ [key: string]: never; }>;


export type HomeMetricsQuery = { __typename?: 'Query', me: { __typename?: 'User', homeMetrics: { __typename?: 'HomeMetrics', totalTracks: number, totalListeningTime: number, artistCount: number, listeningStats: { __typename?: 'ListeningStats', totalPlays: number, totalPlayTime: number }, topArtists: Array<{ __typename?: 'TopArtist', artist: string, trackCount: number, totalDuration: number }>, topGenres: Array<{ __typename?: 'TopGenre', genre: string, trackCount: number }>, recentActivity: Array<{ __typename?: 'RecentActivity', date: string, tracksAdded: number, tracksAnalyzed: number }> } } };

export type GetWaveformDataQueryVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type GetWaveformDataQuery = { __typename?: 'Query', me: { __typename?: 'User', musicPlayer: { __typename?: 'MusicPlayer', currentWaveformData?: Array<number> | null } } };

export type ToggleFavoriteMutationVariables = Exact<{
  trackId: Scalars['String']['input'];
}>;


export type ToggleFavoriteMutation = { __typename?: 'Mutation', toggleFavorite: { __typename?: 'MusicTrack', id: string, isFavorite: boolean, updatedAt: any, originalArtist?: string | null, originalTitle?: string | null } };

export type SimpleMusicTrackFragmentFragment = { __typename?: 'SimpleMusicTrack', id: string, artist?: string | null, format?: string | null, title?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, date?: any | null, listeningCount?: number | null, lastPlayedAt?: any | null, isFavorite?: boolean | null, isLiked?: boolean | null, isBanger?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, imagePath?: string | null, lastScannedAt?: any | null, fileCreatedAt?: any | null, description?: string | null, tags?: Array<string> | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null, libraryId?: string | null };

export type GetPlaylistsQueryVariables = Exact<{
  verifyTrackId?: InputMaybe<Scalars['Base64ID']['input']>;
}>;


export type GetPlaylistsQuery = { __typename?: 'Query', me: { __typename?: 'User', playlists: { __typename?: 'PlaylistsResult', items: Array<{ __typename?: 'CleanArchPlaylist', id: any, name: string, description?: string | null, createdAt: any, updatedAt: any, isPublic: boolean, createdById: any, updatedById?: any | null, containsTrack?: boolean | null, stats?: { __typename?: 'CleanArchPlaylistStats', genresCount: number, numberOfTracks: number, subgenresCount: number, topGenres: Array<string>, topSubgenres: Array<string>, totalDuration: number, images: Array<string>, bpmRange: { __typename?: 'Range', min: number, max: number }, energyRange: { __typename?: 'Range', min: number, max: number } } | null }> } } };

export type GetPlaylistQueryVariables = Exact<{
  id: Scalars['Base64ID']['input'];
}>;


export type GetPlaylistQuery = { __typename?: 'Query', node?:
    | { __typename?: 'CleanArchPlaylist', id: any, name: string, description?: string | null, isPublic: boolean, createdAt: any, updatedAt: any, createdById: any, updatedById?: any | null, stats?: { __typename?: 'CleanArchPlaylistStats', genresCount: number, numberOfTracks: number, subgenresCount: number, topGenres: Array<string>, topSubgenres: Array<string>, totalDuration: number, images: Array<string>, bpmRange: { __typename?: 'Range', min: number, max: number }, energyRange: { __typename?: 'Range', min: number, max: number } } | null, sorting?: { __typename?: 'CleanArchPlaylistSorting', id: any, playlistId: any, sortingKey: string, sortingDirection: string, createdAt: any, updatedAt: any } | null, tracks?: Array<{ __typename?: 'CleanArchPlaylistTrack', id: any, position: number, addedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } } | null }> | null }
    | { __typename?: 'Library' }
    | { __typename?: 'Track' }
    | { __typename?: 'User' }
   | null };

export type GetFavoritePlaylistQueryVariables = Exact<{ [key: string]: never; }>;


export type GetFavoritePlaylistQuery = { __typename?: 'Query', favoritePlaylist: { __typename?: 'CleanArchPlaylist', id: any, name: string, description?: string | null, isPublic: boolean, createdAt: any, updatedAt: any, createdById: any, updatedById?: any | null, stats?: { __typename?: 'CleanArchPlaylistStats', genresCount: number, numberOfTracks: number, subgenresCount: number, topGenres: Array<string>, topSubgenres: Array<string>, totalDuration: number, images: Array<string>, bpmRange: { __typename?: 'Range', min: number, max: number }, energyRange: { __typename?: 'Range', min: number, max: number } } | null, sorting?: { __typename?: 'CleanArchPlaylistSorting', id: any, playlistId: any, sortingKey: string, sortingDirection: string, createdAt: any, updatedAt: any } | null, tracks?: Array<{ __typename?: 'CleanArchPlaylistTrack', id: any, position: number, addedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } } | null }> | null } };

export type CreatePlaylistMutationVariables = Exact<{
  input: CreatePlaylistInput;
}>;


export type CreatePlaylistMutation = { __typename?: 'Mutation', createPlaylist: { __typename?: 'CleanArchPlaylist', id: any, name: string, description?: string | null, createdAt: any, updatedAt: any } };

export type DeletePlaylistMutationVariables = Exact<{
  id: Scalars['Base64ID']['input'];
}>;


export type DeletePlaylistMutation = { __typename?: 'Mutation', deletePlaylist: boolean };

export type ExportPlaylistToM3UMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
}>;


export type ExportPlaylistToM3UMutation = { __typename?: 'Mutation', exportPlaylistToM3U: string };

export type SyncPlaylistToYouTubeMutationVariables = Exact<{
  playlistId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
}>;


export type SyncPlaylistToYouTubeMutation = { __typename?: 'Mutation', syncPlaylistToYouTube: { __typename?: 'SyncResult', success: boolean, playlistId?: string | null, playlistUrl?: string | null, syncedCount: number, skippedCount: number, errors: Array<string> } };

export type GetYouTubeAuthUrlQueryVariables = Exact<{ [key: string]: never; }>;


export type GetYouTubeAuthUrlQuery = { __typename?: 'Query', getYouTubeAuthUrl: { __typename?: 'YouTubeAuthUrl', authUrl: string } };

export type AuthenticateYouTubeMutationVariables = Exact<{
  code: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;


export type AuthenticateYouTubeMutation = { __typename?: 'Mutation', authenticateYouTube: { __typename?: 'YouTubeAuthResult', success: boolean, message?: string | null } };

export type SyncPlaylistToTidalMutationVariables = Exact<{
  playlistId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
}>;


export type SyncPlaylistToTidalMutation = { __typename?: 'Mutation', syncPlaylistToTidal: { __typename?: 'SyncResult', success: boolean, playlistId?: string | null, playlistUrl?: string | null, syncedCount: number, skippedCount: number, errors: Array<string> } };

export type GetTidalAuthUrlQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTidalAuthUrlQuery = { __typename?: 'Query', getTidalAuthUrl: { __typename?: 'TidalAuthUrl', authUrl: string, codeVerifier: string } };

export type AuthenticateTidalMutationVariables = Exact<{
  code: Scalars['String']['input'];
  codeVerifier: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;


export type AuthenticateTidalMutation = { __typename?: 'Mutation', authenticateTidal: { __typename?: 'TidalAuthResult', success: boolean, message?: string | null } };

export type SyncPlaylistToSpotifyMutationVariables = Exact<{
  playlistId: Scalars['ID']['input'];
  userId: Scalars['String']['input'];
}>;


export type SyncPlaylistToSpotifyMutation = { __typename?: 'Mutation', syncPlaylistToSpotify: { __typename?: 'SyncResult', success: boolean, playlistId?: string | null, playlistUrl?: string | null, syncedCount: number, skippedCount: number, errors: Array<string> } };

export type GetSpotifyAuthUrlQueryVariables = Exact<{ [key: string]: never; }>;


export type GetSpotifyAuthUrlQuery = { __typename?: 'Query', getSpotifyAuthUrl: { __typename?: 'SpotifyAuthUrl', authUrl: string, codeVerifier: string } };

export type AuthenticateSpotifyMutationVariables = Exact<{
  code: Scalars['String']['input'];
  codeVerifier: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;


export type AuthenticateSpotifyMutation = { __typename?: 'Mutation', authenticateSpotify: { __typename?: 'SpotifyAuthResult', success: boolean, message?: string | null } };

export type AddTrackToPlaylistMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  input: AddTrackToPlaylistInput;
}>;


export type AddTrackToPlaylistMutation = { __typename?: 'Mutation', addTrackToPlaylist: { __typename?: 'CleanArchPlaylistTrack', id: any, position: number, addedAt: any } };

export type RemoveTrackFromPlaylistMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  trackId: Scalars['Base64ID']['input'];
}>;


export type RemoveTrackFromPlaylistMutation = { __typename?: 'Mutation', removeTrackFromPlaylist: boolean };

export type GetPlaylistRecommendationsQueryVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  recommendationsLimit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetPlaylistRecommendationsQuery = { __typename?: 'Query', node?:
    | { __typename?: 'CleanArchPlaylist', recommendations?: Array<{ __typename?: 'TrackRecommendation', similarity: number, reasons: Array<string>, track: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } } }> | null }
    | { __typename?: 'Library' }
    | { __typename?: 'Track' }
    | { __typename?: 'User' }
   | null };

export type UpdatePlaylistPositionsMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  input: UpdatePlaylistPositionsInput;
}>;


export type UpdatePlaylistPositionsMutation = { __typename?: 'Mutation', updatePlaylistTracksPositions: boolean };

export type UpdatePlaylistSortingMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  input: UpdatePlaylistSortingInput;
}>;


export type UpdatePlaylistSortingMutation = { __typename?: 'Mutation', updatePlaylistSorting: { __typename?: 'CleanArchPlaylistSorting', id: any, playlistId: any, sortingKey: string, sortingDirection: string, createdAt: any, updatedAt: any } };

export type GetQueueQueryVariables = Exact<{ [key: string]: never; }>;


export type GetQueueQuery = { __typename?: 'Query', me: { __typename?: 'User', queue: Array<{ __typename?: 'QueueItem', id: any, trackId: any, position: number, createdAt: any, updatedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } } | null }> } };

export type AddTrackToQueueMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type AddTrackToQueueMutation = { __typename?: 'Mutation', addTrackToQueue: { __typename?: 'QueueItem', id: any, trackId: any, position: number, createdAt: any, updatedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } } | null } };

export type AddTracksToQueueMutationVariables = Exact<{
  trackIds: Array<Scalars['Base64ID']['input']> | Scalars['Base64ID']['input'];
}>;


export type AddTracksToQueueMutation = { __typename?: 'Mutation', addTracksToQueue: Array<{ __typename?: 'QueueItem', id: any, trackId: any, position: number, createdAt: any, updatedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } } | null }> };

export type RemoveTrackFromQueueMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type RemoveTrackFromQueueMutation = { __typename?: 'Mutation', removeTrackFromQueue: { __typename?: 'RemoveTrackFromQueueResponse', success: boolean, trackId: any, artist?: string | null, title?: string | null } };

export type UpdateQueuePositionsMutationVariables = Exact<{
  input: UpdateQueuePositionsInput;
}>;


export type UpdateQueuePositionsMutation = { __typename?: 'Mutation', updateQueuePositions: Array<{ __typename?: 'QueueItem', id: any, trackId: any, position: number, createdAt: any, updatedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, createdAt?: any | null, updatedAt?: any | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: string | null, stats: { __typename?: 'TrackStats', listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean }, fileInfo: { __typename?: 'TrackFileInfo', filePath: string, fileName: string, fileSize: number, fileCreatedAt: any }, technicalInfo: { __typename?: 'TrackTechnicalInfo', duration: number, format: string }, metadata: { __typename?: 'TrackMetadata', album?: string | null, date?: any | null, genres?: Array<string> | null, subgenres?: Array<string> | null }, aiMetadata: { __typename?: 'TrackAIMetadata', tags?: Array<string> | null, vocalsDesc?: string | null, description?: string | null, vocalsDescriptions?: string | null, atmosphereKeywords?: Array<string> | null, contextBackgrounds?: string | null, contextImpacts?: string | null }, musicalFeatures: { __typename?: 'TrackMusicalFeatures', tempo?: number | null, key?: string | null, valenceMood?: string | null, arousalMood?: string | null, danceabilityFeeling?: string | null, acousticness?: number | null, instrumentalness?: number | null, speechiness?: number | null } } | null }> };

export type ResetQueueMutationVariables = Exact<{ [key: string]: never; }>;


export type ResetQueueMutation = { __typename?: 'Mutation', resetQueue: boolean };

export type UserQueryVariables = Exact<{ [key: string]: never; }>;


export type UserQuery = { __typename?: 'Query', me: { __typename?: 'User', firstName?: string | null, lastName?: string | null, email?: string | null, randomTrackId: any } };
