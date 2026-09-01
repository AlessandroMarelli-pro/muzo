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
  Date: { input: any; output: any; }
};

export type AddTrackToPlaylistInput = {
  position?: InputMaybe<Scalars['Int']['input']>;
  trackId: Scalars['Base64ID']['input'];
};

export type ConnectedProvider = {
  __typename?: 'ConnectedProvider';
  provider: Scalars['String']['output'];
};

export type CosineRecommendedTrack = {
  __typename?: 'CosineRecommendedTrack';
  artist: Scalars['String']['output'];
  externalLink?: Maybe<Scalars['String']['output']>;
  score: Scalars['Float']['output'];
  title: Scalars['String']['output'];
  videoId?: Maybe<Scalars['String']['output']>;
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

export type CursorPaginatedTracks = {
  __typename?: 'CursorPaginatedTracks';
  hasMore: Scalars['Boolean']['output'];
  items?: Maybe<Array<Track>>;
  nextCursor?: Maybe<Scalars['Base64ID']['output']>;
};

export type CursorPaginationArgs = {
  cursor?: InputMaybe<Scalars['Base64ID']['input']>;
  direction?: InputMaybe<Scalars['String']['input']>;
  size?: InputMaybe<Scalars['Int']['input']>;
};

export type DisconnectProviderResult = {
  __typename?: 'DisconnectProviderResult';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type DiscoveredTrack = {
  __typename?: 'DiscoveredTrack';
  artist: Scalars['String']['output'];
  confidence: Scalars['String']['output'];
  externalLink?: Maybe<Scalars['String']['output']>;
  matchScore: Scalars['Float']['output'];
  sourceArtist: Scalars['String']['output'];
  title: Scalars['String']['output'];
  videoId?: Maybe<Scalars['String']['output']>;
};

export type FilterCriteriaInput = {
  arousalMood?: InputMaybe<Array<Scalars['String']['input']>>;
  artist?: InputMaybe<Scalars['String']['input']>;
  danceabilityFeeling?: InputMaybe<Array<Scalars['String']['input']>>;
  genreIds?: InputMaybe<Array<Scalars['Base64ID']['input']>>;
  instrumentalness?: InputMaybe<RangeInput>;
  keyIds?: InputMaybe<Array<Scalars['String']['input']>>;
  libraryIds?: InputMaybe<Array<Scalars['Base64ID']['input']>>;
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
  arousalMood?: Maybe<Array<Scalars['String']['output']>>;
  artist?: Maybe<Scalars['String']['output']>;
  danceabilityFeeling?: Maybe<Array<Scalars['String']['output']>>;
  genreIds?: Maybe<Array<Scalars['Base64ID']['output']>>;
  instrumentalness?: Maybe<Range>;
  keyIds?: Maybe<Array<Scalars['String']['output']>>;
  libraryIds?: Maybe<Array<Scalars['Base64ID']['output']>>;
  subgenreIds?: Maybe<Array<Scalars['Base64ID']['output']>>;
  tempo?: Maybe<Range>;
  title?: Maybe<Scalars['String']['output']>;
  valenceMood?: Maybe<Array<Scalars['String']['output']>>;
};

export type FilterWithId = {
  __typename?: 'FilterWithID';
  id?: Maybe<Scalars['Base64ID']['output']>;
  name?: Maybe<Scalars['String']['output']>;
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

export type HqAudioBatchDownload = {
  __typename?: 'HqAudioBatchDownload';
  batchId: Scalars['Base64ID']['output'];
  totalToDownload: Scalars['Int']['output'];
};

export type Library = Node & {
  __typename?: 'Library';
  analyzedTracks: Scalars['Float']['output'];
  createdAt: Scalars['Date']['output'];
  failedTracks: Scalars['Float']['output'];
  id: Scalars['Base64ID']['output'];
  lastIncrementalScanAt?: Maybe<Scalars['Date']['output']>;
  lastScanAt?: Maybe<Scalars['Date']['output']>;
  name: Scalars['String']['output'];
  pendingTracks: Scalars['Float']['output'];
  rootPath: Scalars['String']['output'];
  scanStatus: Scalars['String']['output'];
  settings: LibrarySettings;
  totalTracks: Scalars['Float']['output'];
  tracks: CursorPaginatedTracks;
  updatedAt?: Maybe<Scalars['Date']['output']>;
};


export type LibraryTracksArgs = {
  pagination?: InputMaybe<CursorPaginationArgs>;
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

export type Mutation = {
  __typename?: 'Mutation';
  addTrackToPlaylist: PlaylistTrack;
  addTrackToQueue: QueueItem;
  addTracksToQueue: Array<QueueItem>;
  authenticateSpotify: SpotifyAuthResult;
  authenticateTidal: TidalAuthResult;
  authenticateYouTube: YouTubeAuthResult;
  caUpdatePlaylist: Playlist;
  cancelPlaylistHqAudioDownload: Scalars['Boolean']['output'];
  createLibrary: Library;
  createPlaylist: Playlist;
  createSavedFilter: FilterCriteriaResult;
  deleteLibrary: Scalars['Boolean']['output'];
  deletePlaylist: Scalars['Boolean']['output'];
  deleteSavedFilter: Scalars['Boolean']['output'];
  disconnectProvider: DisconnectProviderResult;
  downloadHqAudio: Scalars['Boolean']['output'];
  downloadPlaylistHqAudio: HqAudioBatchDownload;
  downloadPlaylistToFolder: Scalars['Boolean']['output'];
  enhanceHqAudio: Scalars['Boolean']['output'];
  exportPlaylistToM3U: Scalars['String']['output'];
  registerPlayedTrack: Scalars['Boolean']['output'];
  removeTrackFromPlaylist: Scalars['Boolean']['output'];
  removeTrackFromQueue: RemoveTrackFromQueueResponse;
  resetQueue: Scalars['Boolean']['output'];
  scanIncompleteTracks: Scalars['Base64ID']['output'];
  scanTrack: Scalars['Base64ID']['output'];
  startLibraryScan: Scalars['Base64ID']['output'];
  stopLibraryScan: Scalars['Boolean']['output'];
  syncPlaylistToSpotify: ThirdPartySyncResult;
  syncPlaylistToTidal: ThirdPartySyncResult;
  syncPlaylistToYouTube: ThirdPartySyncResult;
  toggleBanger: Track;
  toggleDislike: Scalars['Boolean']['output'];
  toggleFavorite: Track;
  toggleLike: Track;
  updatePlaylistSorting: PlaylistSorting;
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


export type MutationCaUpdatePlaylistArgs = {
  id: Scalars['Base64ID']['input'];
  input: UpdatePlaylistInput;
};


export type MutationCancelPlaylistHqAudioDownloadArgs = {
  batchId: Scalars['Base64ID']['input'];
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


export type MutationDisconnectProviderArgs = {
  provider: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};


export type MutationDownloadHqAudioArgs = {
  trackId: Scalars['Base64ID']['input'];
};


export type MutationDownloadPlaylistHqAudioArgs = {
  playlistId: Scalars['Base64ID']['input'];
};


export type MutationDownloadPlaylistToFolderArgs = {
  playlistId: Scalars['Base64ID']['input'];
};


export type MutationEnhanceHqAudioArgs = {
  trackId: Scalars['Base64ID']['input'];
};


export type MutationExportPlaylistToM3UArgs = {
  playlistId: Scalars['Base64ID']['input'];
};


export type MutationRegisterPlayedTrackArgs = {
  trackId: Scalars['Base64ID']['input'];
};


export type MutationRemoveTrackFromPlaylistArgs = {
  playlistId: Scalars['Base64ID']['input'];
  trackId: Scalars['Base64ID']['input'];
};


export type MutationRemoveTrackFromQueueArgs = {
  trackId: Scalars['Base64ID']['input'];
};


export type MutationScanIncompleteTracksArgs = {
  libraryId: Scalars['Base64ID']['input'];
};


export type MutationScanTrackArgs = {
  force?: InputMaybe<Scalars['Boolean']['input']>;
  trackId: Scalars['Base64ID']['input'];
};


export type MutationStartLibraryScanArgs = {
  force?: InputMaybe<Scalars['Boolean']['input']>;
  incremental?: InputMaybe<Scalars['Boolean']['input']>;
  libraryId: Scalars['Base64ID']['input'];
};


export type MutationStopLibraryScanArgs = {
  libraryId: Scalars['Base64ID']['input'];
  sessionId?: InputMaybe<Scalars['Base64ID']['input']>;
};


export type MutationSyncPlaylistToSpotifyArgs = {
  playlistId: Scalars['Base64ID']['input'];
  userId: Scalars['String']['input'];
};


export type MutationSyncPlaylistToTidalArgs = {
  playlistId: Scalars['Base64ID']['input'];
  userId: Scalars['String']['input'];
};


export type MutationSyncPlaylistToYouTubeArgs = {
  playlistId: Scalars['Base64ID']['input'];
  userId: Scalars['String']['input'];
};


export type MutationToggleBangerArgs = {
  trackId: Scalars['Base64ID']['input'];
};


export type MutationToggleDislikeArgs = {
  trackId: Scalars['Base64ID']['input'];
};


export type MutationToggleFavoriteArgs = {
  trackId: Scalars['Base64ID']['input'];
};


export type MutationToggleLikeArgs = {
  trackId: Scalars['Base64ID']['input'];
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

export type PaginatedTracks = {
  __typename?: 'PaginatedTracks';
  items?: Maybe<Array<Track>>;
  limit: Scalars['Int']['output'];
  page: Scalars['Int']['output'];
  pages: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type PaginationArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
};

export type Playlist = Node & {
  __typename?: 'Playlist';
  /** True if the given track is already in this playlist */
  containsTrack?: Maybe<Scalars['Boolean']['output']>;
  createdAt: Scalars['Date']['output'];
  createdById: Scalars['Base64ID']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['Base64ID']['output'];
  isPublic: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  recommendations?: Maybe<Array<TrackRecommendation>>;
  sorting?: Maybe<PlaylistSorting>;
  stats?: Maybe<PlaylistStats>;
  tracks?: Maybe<Array<PlaylistTrack>>;
  updatedAt?: Maybe<Scalars['Date']['output']>;
};


export type PlaylistContainsTrackArgs = {
  trackId?: InputMaybe<Scalars['Base64ID']['input']>;
};


export type PlaylistRecommendationsArgs = {
  boosts?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  seedStrategy?: InputMaybe<Scalars['String']['input']>;
};

export type PlaylistFilterInput = {
  genreIds?: InputMaybe<Array<Scalars['Base64ID']['input']>>;
  libraryIds?: InputMaybe<Array<Scalars['Base64ID']['input']>>;
  subgenreIds?: InputMaybe<Array<Scalars['Base64ID']['input']>>;
  tempo?: InputMaybe<RangeInput>;
};

export type PlaylistSorting = {
  __typename?: 'PlaylistSorting';
  createdAt: Scalars['Date']['output'];
  id: Scalars['Base64ID']['output'];
  playlistId: Scalars['Base64ID']['output'];
  sortingDirection: Scalars['String']['output'];
  sortingKey: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['Date']['output']>;
};

export type PlaylistStats = {
  __typename?: 'PlaylistStats';
  bpmRange: Range;
  genresCount: Scalars['Int']['output'];
  images: Array<Scalars['String']['output']>;
  numberOfTracks: Scalars['Int']['output'];
  subgenresCount: Scalars['Int']['output'];
  topGenres: Array<Scalars['String']['output']>;
  topSubgenres: Array<Scalars['String']['output']>;
  totalDuration: Scalars['Float']['output'];
};

export type PlaylistTrack = {
  __typename?: 'PlaylistTrack';
  addedAt: Scalars['Date']['output'];
  id: Scalars['Base64ID']['output'];
  playlistId: Scalars['Base64ID']['output'];
  position: Scalars['Int']['output'];
  track?: Maybe<Track>;
  trackId: Scalars['Base64ID']['output'];
};

export type PlaylistsResult = {
  __typename?: 'PlaylistsResult';
  items: Array<Playlist>;
};

export type Query = {
  __typename?: 'Query';
  connectedProviders: Array<ConnectedProvider>;
  cosineRecommendationsForTrack: Array<CosineRecommendedTrack>;
  discoverSimilarTracksForPlaylist: Array<DiscoveredTrack>;
  getSpotifyAuthUrl: SpotifyAuthUrl;
  getTidalAuthUrl: TidalAuthUrl;
  getYouTubeAuthUrl: YouTubeAuthUrl;
  me: User;
  /** Fetch any node by global ID. Use inline fragments (... on Playlist { ... }) to request fields. */
  node?: Maybe<Node>;
};


export type QueryConnectedProvidersArgs = {
  userId: Scalars['String']['input'];
};


export type QueryCosineRecommendationsForTrackArgs = {
  trackId: Scalars['Base64ID']['input'];
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryDiscoverSimilarTracksForPlaylistArgs = {
  playlistId: Scalars['Base64ID']['input'];
  userId: Scalars['String']['input'];
};


export type QueryNodeArgs = {
  id: Scalars['Base64ID']['input'];
};

export type QueueItem = {
  __typename?: 'QueueItem';
  createdAt: Scalars['Date']['output'];
  id: Scalars['Base64ID']['output'];
  position: Scalars['Int']['output'];
  track?: Maybe<Track>;
  trackId: Scalars['Base64ID']['output'];
  updatedAt?: Maybe<Scalars['Date']['output']>;
};

export type RandomTrackWithStats = {
  __typename?: 'RandomTrackWithStats';
  bangerCount: Scalars['Float']['output'];
  dislikedCount: Scalars['Float']['output'];
  likedCount: Scalars['Float']['output'];
  remainingCount: Scalars['Float']['output'];
  track?: Maybe<Track>;
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
  genres: Array<FilterWithId>;
  keys: Array<FilterWithId>;
  libraries: Array<FilterWithId>;
  subgenres: Array<FilterWithId>;
};

export type ThirdPartySyncResult = {
  __typename?: 'ThirdPartySyncResult';
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
  analysisStatus?: Maybe<Scalars['String']['output']>;
  artist?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['Date']['output']>;
  date?: Maybe<Scalars['Date']['output']>;
  duration: Scalars['Float']['output'];
  fileCreatedAt: Scalars['Date']['output'];
  fileName: Scalars['String']['output'];
  filePath: Scalars['String']['output'];
  fileSize: Scalars['Float']['output'];
  format?: Maybe<Scalars['String']['output']>;
  genres?: Maybe<Array<Scalars['String']['output']>>;
  hqAudioPath?: Maybe<Scalars['String']['output']>;
  id: Scalars['Base64ID']['output'];
  imagePath?: Maybe<Scalars['String']['output']>;
  isBanger: Scalars['Boolean']['output'];
  isFavorite: Scalars['Boolean']['output'];
  isLiked: Scalars['Boolean']['output'];
  lastPlayedAt?: Maybe<Scalars['Date']['output']>;
  lastScannedAt?: Maybe<Scalars['Date']['output']>;
  libraryId?: Maybe<Scalars['Base64ID']['output']>;
  listeningCount: Scalars['Float']['output'];
  mfArousalMood?: Maybe<Scalars['String']['output']>;
  mfCamelotKey?: Maybe<Scalars['String']['output']>;
  mfDanceability?: Maybe<Scalars['Float']['output']>;
  mfDanceabilityFeeling?: Maybe<Scalars['String']['output']>;
  mfInstrumentalness?: Maybe<Scalars['Float']['output']>;
  mfKey?: Maybe<Scalars['String']['output']>;
  mfMoodAggressive?: Maybe<Scalars['Float']['output']>;
  mfMoodHappy?: Maybe<Scalars['Float']['output']>;
  mfMoodParty?: Maybe<Scalars['Float']['output']>;
  mfMoodRelaxed?: Maybe<Scalars['Float']['output']>;
  mfMoodSad?: Maybe<Scalars['Float']['output']>;
  mfTempo?: Maybe<Scalars['Float']['output']>;
  mfValenceMood?: Maybe<Scalars['String']['output']>;
  mfVoice?: Maybe<Scalars['Float']['output']>;
  recommendations: Array<TrackRecommendation>;
  subgenres?: Maybe<Array<Scalars['String']['output']>>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['Date']['output']>;
};


export type TrackRecommendationsArgs = {
  boosts?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  seedStrategy?: InputMaybe<Scalars['String']['input']>;
};

export type TrackRecommendation = {
  __typename?: 'TrackRecommendation';
  reasons: Array<Scalars['String']['output']>;
  similarity: Scalars['Float']['output'];
  track: Track;
};

export type UpdatePlaylistInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
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
  activeFilters?: Maybe<Array<FilterCriteriaResult>>;
  currentFilter?: Maybe<FilterCriteriaResult>;
  email?: Maybe<Scalars['String']['output']>;
  favorites: Playlist;
  firstName?: Maybe<Scalars['String']['output']>;
  homeMetrics: HomeMetrics;
  id: Scalars['Base64ID']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  libraries: Array<Library>;
  musicPlayer: MusicPlayer;
  paginatedTracks: PaginatedTracks;
  pendingTracks: PaginatedTracks;
  playlists: PlaylistsResult;
  queue: Array<QueueItem>;
  randomTrackId?: Maybe<Scalars['Base64ID']['output']>;
  randomTrackWithStats: RandomTrackWithStats;
  recentlyPlayed: Array<Track>;
  staticFilterOptions: StaticFilterOptions;
  tracks: CursorPaginatedTracks;
};


export type UserPaginatedTracksArgs = {
  pagination?: InputMaybe<PaginationArgs>;
};


export type UserPendingTracksArgs = {
  pagination?: InputMaybe<PaginationArgs>;
};


export type UserTracksArgs = {
  pagination?: InputMaybe<CursorPaginationArgs>;
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


export type GetLibrariesQuery = { __typename?: 'Query', me: { __typename?: 'User', libraries: Array<{ __typename?: 'Library', id: any, name: string, rootPath: string, totalTracks: number, analyzedTracks: number, pendingTracks: number, failedTracks: number, lastScanAt?: any | null, lastIncrementalScanAt?: any | null, scanStatus: string, createdAt: any, updatedAt?: any | null, settings: { __typename?: 'LibrarySettings', autoScan: boolean, includeSubdirectories: boolean, supportedFormats: string, maxFileSize?: number | null, scanInterval?: number | null } }> } };

export type GetLibraryQueryVariables = Exact<{
  id: Scalars['Base64ID']['input'];
}>;


export type GetLibraryQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Library', id: any, name: string, rootPath: string, totalTracks: number, analyzedTracks: number, pendingTracks: number, failedTracks: number, lastScanAt?: any | null, lastIncrementalScanAt?: any | null, scanStatus: string, createdAt: any, updatedAt?: any | null, settings: { __typename?: 'LibrarySettings', autoScan: boolean, includeSubdirectories: boolean, supportedFormats: string, maxFileSize?: number | null, scanInterval?: number | null } }
    | { __typename?: 'Playlist' }
    | { __typename?: 'Track' }
    | { __typename?: 'User' }
   | null };

export type GetLibraryTracksQueryVariables = Exact<{
  id: Scalars['Base64ID']['input'];
  pagination: CursorPaginationArgs;
}>;


export type GetLibraryTracksQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Library', tracks: { __typename?: 'CursorPaginatedTracks', hasMore: boolean, nextCursor?: any | null, items?: Array<{ __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null }> | null } }
    | { __typename?: 'Playlist' }
    | { __typename?: 'Track' }
    | { __typename?: 'User' }
   | null };

export type GetTracksQueryVariables = Exact<{
  pagination: CursorPaginationArgs;
}>;


export type GetTracksQuery = { __typename?: 'Query', me: { __typename?: 'User', tracks: { __typename?: 'CursorPaginatedTracks', hasMore: boolean, nextCursor?: any | null, items?: Array<{ __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null }> | null } } };

export type GetRandomTrackQueryVariables = Exact<{
  id: Scalars['Base64ID']['input'];
}>;


export type GetRandomTrackQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Library' }
    | { __typename?: 'Playlist' }
    | { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null }
    | { __typename?: 'User' }
   | null };

export type GetRandomTrackWithStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRandomTrackWithStatsQuery = { __typename?: 'Query', me: { __typename?: 'User', randomTrackWithStats: { __typename?: 'RandomTrackWithStats', likedCount: number, bangerCount: number, dislikedCount: number, remainingCount: number, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } | null } } };

export type GetTrackRecommendationsQueryVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
  recommendationsLimit?: InputMaybe<Scalars['Int']['input']>;
  boosts?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
}>;


export type GetTrackRecommendationsQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Library' }
    | { __typename?: 'Playlist' }
    | { __typename?: 'Track', recommendations: Array<{ __typename?: 'TrackRecommendation', similarity: number, reasons: Array<string>, track: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } }> }
    | { __typename?: 'User' }
   | null };

export type GetTracksListQueryVariables = Exact<{
  pagination?: InputMaybe<PaginationArgs>;
}>;


export type GetTracksListQuery = { __typename?: 'Query', me: { __typename?: 'User', paginatedTracks: { __typename?: 'PaginatedTracks', total: number, page: number, limit: number, pages: number, items?: Array<{ __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null }> | null } } };

export type GetPendingTracksQueryVariables = Exact<{
  pagination?: InputMaybe<PaginationArgs>;
}>;


export type GetPendingTracksQuery = { __typename?: 'Query', me: { __typename?: 'User', pendingTracks: { __typename?: 'PaginatedTracks', total: number, page: number, limit: number, pages: number, items?: Array<{ __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null }> | null } } };

export type GetStaticFiltersQueryVariables = Exact<{ [key: string]: never; }>;


export type GetStaticFiltersQuery = { __typename?: 'Query', me: { __typename?: 'User', staticFilterOptions: { __typename?: 'StaticFilterOptions', genres: Array<{ __typename?: 'FilterWithID', id?: any | null, name?: string | null }>, subgenres: Array<{ __typename?: 'FilterWithID', id?: any | null, name?: string | null }>, keys: Array<{ __typename?: 'FilterWithID', id?: any | null, name?: string | null }>, libraries: Array<{ __typename?: 'FilterWithID', id?: any | null, name?: string | null }> } } };

export type GetRecentlyPlayedQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRecentlyPlayedQuery = { __typename?: 'Query', me: { __typename?: 'User', recentlyPlayed: Array<{ __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null }> } };

export type LikeTrackMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type LikeTrackMutation = { __typename?: 'Mutation', toggleLike: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } };

export type BangerTrackMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type BangerTrackMutation = { __typename?: 'Mutation', toggleBanger: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } };

export type ToggleDislikeMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type ToggleDislikeMutation = { __typename?: 'Mutation', toggleDislike: boolean };

export type ScanTrackMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
  force?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type ScanTrackMutation = { __typename?: 'Mutation', scanTrack: any };

export type DownloadHqAudioMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type DownloadHqAudioMutation = { __typename?: 'Mutation', downloadHqAudio: boolean };

export type EnhanceHqAudioMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type EnhanceHqAudioMutation = { __typename?: 'Mutation', enhanceHqAudio: boolean };

export type DownloadPlaylistHqAudioMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
}>;


export type DownloadPlaylistHqAudioMutation = { __typename?: 'Mutation', downloadPlaylistHqAudio: { __typename?: 'HqAudioBatchDownload', batchId: any, totalToDownload: number } };

export type CancelPlaylistHqAudioDownloadMutationVariables = Exact<{
  batchId: Scalars['Base64ID']['input'];
}>;


export type CancelPlaylistHqAudioDownloadMutation = { __typename?: 'Mutation', cancelPlaylistHqAudioDownload: boolean };

export type ActiveFiltersQueryVariables = Exact<{ [key: string]: never; }>;


export type ActiveFiltersQuery = { __typename?: 'Query', me: { __typename?: 'User', activeFilters?: Array<{ __typename?: 'FilterCriteriaResult', id: any, name: string, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genreIds?: Array<any> | null, keyIds?: Array<string> | null, subgenreIds?: Array<any> | null, artist?: string | null, title?: string | null, libraryIds?: Array<any> | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null } }> | null } };

export type GetCurrentFilterQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCurrentFilterQuery = { __typename?: 'Query', me: { __typename?: 'User', currentFilter?: { __typename?: 'FilterCriteriaResult', id: any, name: string, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genreIds?: Array<any> | null, keyIds?: Array<string> | null, subgenreIds?: Array<any> | null, artist?: string | null, title?: string | null, libraryIds?: Array<any> | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null } } | null } };

export type CreateFilterMutationVariables = Exact<{
  input: SavedFilterInput;
}>;


export type CreateFilterMutation = { __typename?: 'Mutation', createSavedFilter: { __typename?: 'FilterCriteriaResult', id: any, name: string, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genreIds?: Array<any> | null, keyIds?: Array<string> | null, subgenreIds?: Array<any> | null, artist?: string | null, title?: string | null, libraryIds?: Array<any> | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null } } };

export type UpdateFilterMutationVariables = Exact<{
  id: Scalars['Base64ID']['input'];
  input: SavedFilterInput;
}>;


export type UpdateFilterMutation = { __typename?: 'Mutation', updateSavedFilter: { __typename?: 'FilterCriteriaResult', id: any, name: string, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genreIds?: Array<any> | null, keyIds?: Array<string> | null, subgenreIds?: Array<any> | null, artist?: string | null, title?: string | null, libraryIds?: Array<any> | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null } } };

export type DeleteActiveFilterMutationVariables = Exact<{
  id: Scalars['Base64ID']['input'];
}>;


export type DeleteActiveFilterMutation = { __typename?: 'Mutation', deleteSavedFilter: boolean };

export type TrackFragmentFragment = { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null };

export type PlaylistTrackFragmentFragment = { __typename?: 'PlaylistTrack', id: any, position: number, addedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } | null };

export type PlaylistFragmentFragment = { __typename?: 'Playlist', id: any, name: string, description?: string | null, isPublic: boolean, createdAt: any, updatedAt?: any | null, createdById: any, stats?: { __typename?: 'PlaylistStats', genresCount: number, numberOfTracks: number, subgenresCount: number, topGenres: Array<string>, topSubgenres: Array<string>, totalDuration: number, images: Array<string>, bpmRange: { __typename?: 'Range', min: number, max: number } } | null, sorting?: { __typename?: 'PlaylistSorting', id: any, playlistId: any, sortingKey: string, sortingDirection: string, createdAt: any, updatedAt?: any | null } | null, tracks?: Array<{ __typename?: 'PlaylistTrack', id: any, position: number, addedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } | null }> | null };

export type FilterFragmentFragment = { __typename?: 'FilterCriteriaResult', id: any, name: string, criteria: { __typename?: 'FilterCriteriaType', valenceMood?: Array<string> | null, arousalMood?: Array<string> | null, danceabilityFeeling?: Array<string> | null, genreIds?: Array<any> | null, keyIds?: Array<string> | null, subgenreIds?: Array<any> | null, artist?: string | null, title?: string | null, libraryIds?: Array<any> | null, tempo?: { __typename?: 'Range', max: number, min: number } | null, instrumentalness?: { __typename?: 'Range', max: number, min: number } | null } };

export type LibraryFragmentFragment = { __typename?: 'Library', id: any, name: string, rootPath: string, totalTracks: number, analyzedTracks: number, pendingTracks: number, failedTracks: number, lastScanAt?: any | null, lastIncrementalScanAt?: any | null, scanStatus: string, createdAt: any, updatedAt?: any | null, settings: { __typename?: 'LibrarySettings', autoScan: boolean, includeSubdirectories: boolean, supportedFormats: string, maxFileSize?: number | null, scanInterval?: number | null } };

export type HomeMetricsQueryVariables = Exact<{ [key: string]: never; }>;


export type HomeMetricsQuery = { __typename?: 'Query', me: { __typename?: 'User', homeMetrics: { __typename?: 'HomeMetrics', totalTracks: number, totalListeningTime: number, artistCount: number, listeningStats: { __typename?: 'ListeningStats', totalPlays: number, totalPlayTime: number, favoriteCount: number }, topArtists: Array<{ __typename?: 'TopArtist', artist: string, trackCount: number, totalDuration: number }>, topGenres: Array<{ __typename?: 'TopGenre', genre: string, trackCount: number }>, recentActivity: Array<{ __typename?: 'RecentActivity', date: string, tracksAdded: number, tracksAnalyzed: number }> } } };

export type GetWaveformDataQueryVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type GetWaveformDataQuery = { __typename?: 'Query', me: { __typename?: 'User', musicPlayer: { __typename?: 'MusicPlayer', currentWaveformData?: Array<number> | null } } };

export type RegisterPlayedTrackMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type RegisterPlayedTrackMutation = { __typename?: 'Mutation', registerPlayedTrack: boolean };

export type ToggleFavoriteMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type ToggleFavoriteMutation = { __typename?: 'Mutation', toggleFavorite: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } };

export type GetPlaylistsQueryVariables = Exact<{
  verifyTrackId?: InputMaybe<Scalars['Base64ID']['input']>;
}>;


export type GetPlaylistsQuery = { __typename?: 'Query', me: { __typename?: 'User', playlists: { __typename?: 'PlaylistsResult', items: Array<{ __typename?: 'Playlist', id: any, name: string, description?: string | null, createdAt: any, updatedAt?: any | null, isPublic: boolean, createdById: any, containsTrack?: boolean | null, stats?: { __typename?: 'PlaylistStats', genresCount: number, numberOfTracks: number, subgenresCount: number, topGenres: Array<string>, topSubgenres: Array<string>, totalDuration: number, images: Array<string>, bpmRange: { __typename?: 'Range', min: number, max: number } } | null }> } } };

export type GetPlaylistQueryVariables = Exact<{
  id: Scalars['Base64ID']['input'];
}>;


export type GetPlaylistQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Library' }
    | { __typename?: 'Playlist', id: any, name: string, description?: string | null, isPublic: boolean, createdAt: any, updatedAt?: any | null, createdById: any, stats?: { __typename?: 'PlaylistStats', genresCount: number, numberOfTracks: number, subgenresCount: number, topGenres: Array<string>, topSubgenres: Array<string>, totalDuration: number, images: Array<string>, bpmRange: { __typename?: 'Range', min: number, max: number } } | null, sorting?: { __typename?: 'PlaylistSorting', id: any, playlistId: any, sortingKey: string, sortingDirection: string, createdAt: any, updatedAt?: any | null } | null, tracks?: Array<{ __typename?: 'PlaylistTrack', id: any, position: number, addedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } | null }> | null }
    | { __typename?: 'Track' }
    | { __typename?: 'User' }
   | null };

export type GetFavoritePlaylistQueryVariables = Exact<{ [key: string]: never; }>;


export type GetFavoritePlaylistQuery = { __typename?: 'Query', me: { __typename?: 'User', favorites: { __typename?: 'Playlist', id: any, name: string, description?: string | null, isPublic: boolean, createdAt: any, updatedAt?: any | null, createdById: any, stats?: { __typename?: 'PlaylistStats', genresCount: number, numberOfTracks: number, subgenresCount: number, topGenres: Array<string>, topSubgenres: Array<string>, totalDuration: number, images: Array<string>, bpmRange: { __typename?: 'Range', min: number, max: number } } | null, sorting?: { __typename?: 'PlaylistSorting', id: any, playlistId: any, sortingKey: string, sortingDirection: string, createdAt: any, updatedAt?: any | null } | null, tracks?: Array<{ __typename?: 'PlaylistTrack', id: any, position: number, addedAt: any, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } | null }> | null } } };

export type CreatePlaylistMutationVariables = Exact<{
  input: CreatePlaylistInput;
}>;


export type CreatePlaylistMutation = { __typename?: 'Mutation', createPlaylist: { __typename?: 'Playlist', id: any, name: string, description?: string | null, createdAt: any, updatedAt?: any | null } };

export type DeletePlaylistMutationVariables = Exact<{
  id: Scalars['Base64ID']['input'];
}>;


export type DeletePlaylistMutation = { __typename?: 'Mutation', deletePlaylist: boolean };

export type ExportPlaylistToM3UMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
}>;


export type ExportPlaylistToM3UMutation = { __typename?: 'Mutation', exportPlaylistToM3U: string };

export type DownloadPlaylistToFolderMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
}>;


export type DownloadPlaylistToFolderMutation = { __typename?: 'Mutation', downloadPlaylistToFolder: boolean };

export type SyncPlaylistToYouTubeMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  userId: Scalars['String']['input'];
}>;


export type SyncPlaylistToYouTubeMutation = { __typename?: 'Mutation', syncPlaylistToYouTube: { __typename?: 'ThirdPartySyncResult', success: boolean, playlistId?: string | null, playlistUrl?: string | null, syncedCount: number, skippedCount: number, errors: Array<string> } };

export type GetYouTubeAuthUrlQueryVariables = Exact<{ [key: string]: never; }>;


export type GetYouTubeAuthUrlQuery = { __typename?: 'Query', getYouTubeAuthUrl: { __typename?: 'YouTubeAuthUrl', authUrl: string } };

export type AuthenticateYouTubeMutationVariables = Exact<{
  code: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;


export type AuthenticateYouTubeMutation = { __typename?: 'Mutation', authenticateYouTube: { __typename?: 'YouTubeAuthResult', success: boolean, message?: string | null } };

export type SyncPlaylistToTidalMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  userId: Scalars['String']['input'];
}>;


export type SyncPlaylistToTidalMutation = { __typename?: 'Mutation', syncPlaylistToTidal: { __typename?: 'ThirdPartySyncResult', success: boolean, playlistId?: string | null, playlistUrl?: string | null, syncedCount: number, skippedCount: number, errors: Array<string> } };

export type GetTidalAuthUrlQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTidalAuthUrlQuery = { __typename?: 'Query', getTidalAuthUrl: { __typename?: 'TidalAuthUrl', authUrl: string, codeVerifier: string } };

export type AuthenticateTidalMutationVariables = Exact<{
  code: Scalars['String']['input'];
  codeVerifier: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;


export type AuthenticateTidalMutation = { __typename?: 'Mutation', authenticateTidal: { __typename?: 'TidalAuthResult', success: boolean, message?: string | null } };

export type SyncPlaylistToSpotifyMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  userId: Scalars['String']['input'];
}>;


export type SyncPlaylistToSpotifyMutation = { __typename?: 'Mutation', syncPlaylistToSpotify: { __typename?: 'ThirdPartySyncResult', success: boolean, playlistId?: string | null, playlistUrl?: string | null, syncedCount: number, skippedCount: number, errors: Array<string> } };

export type GetSpotifyAuthUrlQueryVariables = Exact<{ [key: string]: never; }>;


export type GetSpotifyAuthUrlQuery = { __typename?: 'Query', getSpotifyAuthUrl: { __typename?: 'SpotifyAuthUrl', authUrl: string, codeVerifier: string } };

export type AuthenticateSpotifyMutationVariables = Exact<{
  code: Scalars['String']['input'];
  codeVerifier: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;


export type AuthenticateSpotifyMutation = { __typename?: 'Mutation', authenticateSpotify: { __typename?: 'SpotifyAuthResult', success: boolean, message?: string | null } };

export type ConnectedProvidersQueryVariables = Exact<{
  userId: Scalars['String']['input'];
}>;


export type ConnectedProvidersQuery = { __typename?: 'Query', connectedProviders: Array<{ __typename?: 'ConnectedProvider', provider: string }> };

export type DisconnectProviderMutationVariables = Exact<{
  userId: Scalars['String']['input'];
  provider: Scalars['String']['input'];
}>;


export type DisconnectProviderMutation = { __typename?: 'Mutation', disconnectProvider: { __typename?: 'DisconnectProviderResult', success: boolean, message?: string | null } };

export type AddTrackToPlaylistMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  input: AddTrackToPlaylistInput;
}>;


export type AddTrackToPlaylistMutation = { __typename?: 'Mutation', addTrackToPlaylist: { __typename?: 'PlaylistTrack', id: any, position: number, addedAt: any } };

export type RemoveTrackFromPlaylistMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  trackId: Scalars['Base64ID']['input'];
}>;


export type RemoveTrackFromPlaylistMutation = { __typename?: 'Mutation', removeTrackFromPlaylist: boolean };

export type GetPlaylistRecommendationsQueryVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  recommendationsLimit?: InputMaybe<Scalars['Int']['input']>;
  seedStrategy?: InputMaybe<Scalars['String']['input']>;
  boosts?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
}>;


export type GetPlaylistRecommendationsQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Library' }
    | { __typename?: 'Playlist', recommendations?: Array<{ __typename?: 'TrackRecommendation', similarity: number, reasons: Array<string>, track: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } }> | null }
    | { __typename?: 'Track' }
    | { __typename?: 'User' }
   | null };

export type UpdatePlaylistPositionsMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  input: UpdatePlaylistPositionsInput;
}>;


export type UpdatePlaylistPositionsMutation = { __typename?: 'Mutation', updatePlaylistTracksPositions: boolean };

export type DiscoverSimilarTracksForPlaylistQueryVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  userId: Scalars['String']['input'];
}>;


export type DiscoverSimilarTracksForPlaylistQuery = { __typename?: 'Query', discoverSimilarTracksForPlaylist: Array<{ __typename?: 'DiscoveredTrack', sourceArtist: string, artist: string, title: string, matchScore: number, externalLink?: string | null, videoId?: string | null, confidence: string }> };

export type CosineRecommendationsForTrackQueryVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type CosineRecommendationsForTrackQuery = { __typename?: 'Query', cosineRecommendationsForTrack: Array<{ __typename?: 'CosineRecommendedTrack', artist: string, title: string, score: number, externalLink?: string | null, videoId?: string | null }> };

export type UpdatePlaylistSortingMutationVariables = Exact<{
  playlistId: Scalars['Base64ID']['input'];
  input: UpdatePlaylistSortingInput;
}>;


export type UpdatePlaylistSortingMutation = { __typename?: 'Mutation', updatePlaylistSorting: { __typename?: 'PlaylistSorting', id: any, playlistId: any, sortingKey: string, sortingDirection: string, createdAt: any, updatedAt?: any | null } };

export type GetQueueQueryVariables = Exact<{ [key: string]: never; }>;


export type GetQueueQuery = { __typename?: 'Query', me: { __typename?: 'User', queue: Array<{ __typename?: 'QueueItem', id: any, trackId: any, position: number, createdAt: any, updatedAt?: any | null, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } | null }> } };

export type AddTrackToQueueMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type AddTrackToQueueMutation = { __typename?: 'Mutation', addTrackToQueue: { __typename?: 'QueueItem', id: any, trackId: any, position: number, createdAt: any, updatedAt?: any | null, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } | null } };

export type AddTracksToQueueMutationVariables = Exact<{
  trackIds: Array<Scalars['Base64ID']['input']> | Scalars['Base64ID']['input'];
}>;


export type AddTracksToQueueMutation = { __typename?: 'Mutation', addTracksToQueue: Array<{ __typename?: 'QueueItem', id: any, trackId: any, position: number, createdAt: any, updatedAt?: any | null, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } | null }> };

export type RemoveTrackFromQueueMutationVariables = Exact<{
  trackId: Scalars['Base64ID']['input'];
}>;


export type RemoveTrackFromQueueMutation = { __typename?: 'Mutation', removeTrackFromQueue: { __typename?: 'RemoveTrackFromQueueResponse', success: boolean, trackId: any, artist?: string | null, title?: string | null } };

export type UpdateQueuePositionsMutationVariables = Exact<{
  input: UpdateQueuePositionsInput;
}>;


export type UpdateQueuePositionsMutation = { __typename?: 'Mutation', updateQueuePositions: Array<{ __typename?: 'QueueItem', id: any, trackId: any, position: number, createdAt: any, updatedAt?: any | null, track?: { __typename?: 'Track', id: any, artist?: string | null, title?: string | null, listeningCount: number, lastPlayedAt?: any | null, isFavorite: boolean, isLiked: boolean, isBanger: boolean, filePath: string, fileName: string, fileCreatedAt: any, fileSize: number, hqAudioPath?: string | null, duration: number, genres?: Array<string> | null, subgenres?: Array<string> | null, createdAt?: any | null, updatedAt?: any | null, mfTempo?: number | null, mfKey?: string | null, mfCamelotKey?: string | null, mfValenceMood?: string | null, mfArousalMood?: string | null, mfDanceabilityFeeling?: string | null, mfDanceability?: number | null, mfInstrumentalness?: number | null, mfVoice?: number | null, mfMoodHappy?: number | null, mfMoodSad?: number | null, mfMoodRelaxed?: number | null, mfMoodAggressive?: number | null, mfMoodParty?: number | null, imagePath?: string | null, lastScannedAt?: any | null, libraryId?: any | null, analysisStatus?: string | null, date?: any | null, format?: string | null } | null }> };

export type ResetQueueMutationVariables = Exact<{ [key: string]: never; }>;


export type ResetQueueMutation = { __typename?: 'Mutation', resetQueue: boolean };

export type UserQueryVariables = Exact<{ [key: string]: never; }>;


export type UserQuery = { __typename?: 'Query', me: { __typename?: 'User', firstName?: string | null, lastName?: string | null, email?: string | null, randomTrackId?: any | null } };
