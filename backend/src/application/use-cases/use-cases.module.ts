import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CosineInfrastructureModule } from 'src/infrastructure/external-services/cosine/cosine.module';
import { ThirdPartySyncInfrastructureModule } from 'src/infrastructure/external-services/third-party-sync/third-party-sync.module';
import { HqAudioInfrastructureModule } from 'src/infrastructure/hq-audio/hq-audio.module';
import { SockseekAcquirer } from 'src/infrastructure/hq-audio/sockseek.acquirer';
import { TidalDlAcquirer } from 'src/infrastructure/hq-audio/tidal-dl.acquirer';
import { AI_SERVICE_POOL } from '../ports/infrastructure/IAiServicePool';
import { AUDIO_ANALYSIS_STRUCTURE } from '../ports/infrastructure/IAudioAnalysisStructure';
import { AUDIO_SCAN_SCHEDULER_PRODUCER } from '../ports/infrastructure/IAudioScanSchedulerProducer';
import { DOCKER_SCALING_SERVICE } from '../ports/infrastructure/IDockerScalingService';
import { EMBEDDING_BACKFILL_PRODUCER } from '../ports/infrastructure/IEmbeddingBackfillProducer';
import { AUDIO_WAVEFORM_GENERATOR } from '../ports/infrastructure/IAudioWaveformGenerator';
import { COPY_AUDIO_WITH_METADATA } from '../ports/infrastructure/ICopyAudioWithMetadata';
import { FILE_MANAGER } from '../ports/infrastructure/IFileManager';
import { HQ_AUDIO_ACQUIRE_PRODUCER } from '../ports/infrastructure/IHqAudioAcquireProducer';
import { HQ_AUDIO_ACQUIRER } from '../ports/infrastructure/IHqAudioAcquirer';
import { HQ_AUDIO_ENHANCER } from '../ports/infrastructure/IHqAudioEnhancer';
import { HQ_AUDIO_TAGGER } from '../ports/infrastructure/IHqAudioTagger';
import { HQ_AUDIO_VERIFIER } from '../ports/infrastructure/IHqAudioVerifier';
import { HQ_AUDIO_BATCH_ACQUIRE_PRODUCER } from '../ports/infrastructure/IHqAudioBatchAcquireProducer';
import { HQ_AUDIO_BATCH_PROGRESS_PUBLISHER } from '../ports/infrastructure/IHqAudioBatchProgressPublisher';
import { HQ_AUDIO_BATCH_PROGRESS_SUBSCRIBER } from '../ports/infrastructure/IHqAudioBatchProgressSubscriber';
import { ID3_READER } from '../ports/infrastructure/IId3Reader';
import { IMAGE_FILE_READER } from '../ports/infrastructure/IImageFileReader';
import { COSINE_PROVIDER } from '../ports/infrastructure/ICosineProvider';
import { COSINE_TRACK_MATCH_REPOSITORY } from '../ports/repositories/ICosineTrackMatchRepository';
import { LIBRARY_SCAN_SCHEDULER_PRODUCER } from '../ports/infrastructure/ILibraryScanSchedulerProducer';
import { LOGGER } from '../ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from '../ports/infrastructure/ILoggerFactory';
import { SCAN_PROGRESS_PUBLISHER } from '../ports/infrastructure/IScanProgressPublisher';
import { SCAN_PROGRESS_SUBSCRIBER } from '../ports/infrastructure/IScanProgressSubscriber';
import { SPOTIFY_SYNC_PROVIDER } from '../ports/infrastructure/ISpotifySyncProvider';
import { TIDAL_SYNC_PROVIDER } from '../ports/infrastructure/ITidalSyncProvider';
import { YOUTUBE_SYNC_PROVIDER } from '../ports/infrastructure/IYouTubeSyncProvider';
import { HEALTH_QUERY } from '../ports/queries/IHealthQuery';
import { METRICS_QUERY } from '../ports/queries/IMetricsQuery';
import { MUSIC_TRACK_QUERIES } from '../ports/queries/IMusicTrackQueries';
import { PLAYLIST_STATS_QUERY } from '../ports/queries/IPlaylistStatsQuery';
import { RECOMMENDATION_DATA_PORT } from '../ports/queries/IRecommendationDataPort';
import { RECOMMENDATION_SEARCH_PORT } from '../ports/queries/IRecommendationSearchPort';
import { SAVED_FILTER_QUERY } from '../ports/queries/ISavedFilterQuery';
import { TRACK_INDEXER_PORT } from '../ports/queries/ITrackIndexerPort';
import { AI_SERVICE_SETTINGS_REPOSITORY } from '../ports/repositories/IAiServiceSettingsRepository';
import { AUDIO_ANALYSIS_REPOSITORY } from '../ports/repositories/IAudioAnalysisRepository';
import { HIDDEN_MUSIC_TRACK_REPOSITORY } from '../ports/repositories/IHiddenMusicTrackRepository';
import { IMAGE_SEARCH_REPOSITORY } from '../ports/repositories/IImageSearchRepository';
import { MUSIC_LIBRARY_REPOSITORY } from '../ports/repositories/IMusicLibraryRepository';
import { OAUTH_TOKEN_REPOSITORY } from '../ports/repositories/IOAuthTokenRepository';
import { MUSIC_TRACK_REPOSITORY } from '../ports/repositories/IMusicTrackRepository';
import { PLAYLIST_REPOSITORY } from '../ports/repositories/IPlaylistRepository';
import { PLAYLIST_SORTING_REPOSITORY } from '../ports/repositories/IPlaylistSortingRepository';
import { PLAYLIST_TRACK_REPOSITORY } from '../ports/repositories/IPlaylistTrackRepository';
import { QUEUE_REPOSITORY } from '../ports/repositories/IQueueRepository';
import { SAVED_FILTER_REPOSITORY } from '../ports/repositories/ISavedFilterRepository';
import { SCAN_SESSION_REPOSITORY } from '../ports/repositories/IScanSessionRepository';
import { createUseCaseProvider } from './create-use-case.provider';
import { HealthCheckUseCase } from './health/HealthCheck';
import { AcquireHqAudioBatchUseCase } from './hq-audio-batch/AcquireHqAudioBatch';
import { StartHqAudioBatchDownloadUseCase } from './hq-audio-batch/StartHqAudioBatchDownload';
import { StreamHqAudioBatchProgressUseCase } from './hq-audio-batch/StreamHqAudioBatchProgress';
import {
  AcquireHqAudioUseCase,
  AddImageSearchRecordUseCase,
  AddTracksToQueueUseCase,
  AddTrackToPlaylistUseCase,
  AddTrackToQueueUseCase,
  BackfillTrackEmbeddingsUseCase,
  CreateLibraryUseCase,
  CreatePlaylistUseCase,
  CreateSavedFilterUseCase,
  DeleteLibraryUseCase,
  DeletePlaylistUseCase,
  DeleteSavedFilterUseCase,
  DiscoverSimilarTracksForPlaylistUseCase,
  DownloadPlaylistToFolderUseCase,
  EnhanceHqAudioUseCase,
  ExportPlaylistToM3UUseCase,
  GetActiveFiltersUseCase,
  GetCurrentFilterUseCase,
  GetCosineRecommendationsForTrackUseCase,
  GetFavoriteUseCase,
  GetHomeMetricsUseCase,
  GetLibrariesUseCase,
  GetLibraryUseCase,
  GetPendingTracksUseCase,
  GetPlaylistRecommendationsUseCase,
  GetPlaylistSortingByPlaylistIdUseCase,
  GetPlaylistsStatsUseCase,
  GetPlaylistStatsUseCase,
  GetPlaylistsUseCase,
  GetPlaylistTracksUseCase,
  GetPlaylistTracksWithDetailUseCase,
  GetPlaylistUseCase,
  GetQueueUseCase,
  GetRandomTrackIdUseCase,
  GetRandomTrackWithStatsUseCase,
  GetRecentlyPlayedUseCase,
  GetStaticFilterOptionsUseCase,
  GetTrackRecommendationsUseCase,
  GetTracksUseCase,
  GetTracksWithCursorPaginationUseCase,
  GetTracksWithPaginationUseCase,
  GetTrackUseCase,
  GetWaveformDataUseCase,
  ProcessBatchAudioScanUseCase,
  ProcessEndBatchAudioScanUseCase,
  ProcessEndLibraryScanUseCase,
  ProcessSingleTrackAnalysisUseCase,
  ProcessStartLibraryScanUseCase,
  RecreateElasticsearchIndexUseCase,
  RegisterPlayedTrackUseCase,
  RemoveTrackFromPlaylistUseCase,
  RemoveTrackFromQueueUseCase,
  ResetQueueUseCase,
  ScheduleBatchAudioScanUseCase,
  ScheduleIncompleteTracksScanUseCase,
  ScheduleLibraryScanUseCase,
  SchedulePlaylistTracksScanUseCase,
  ScheduleSingleTrackScanUseCase,
  ScheduleTracksByCriteriaScanUseCase,
  ServeImageUseCase,
  ServeTrackImageUseCase,
  StopLibraryScanUseCase,
  SyncAllTracksToElasticsearchUseCase,
  SyncTrackToElasticSearchUseCase,
  ToggleBangerUseCase,
  ToggleDislikeUseCase,
  ToggleFavoriteUseCase,
  ToggleLikeUseCase,
  UpdatePlaylistSortingUseCase,
  UpdatePlaylistTracksPositionsUseCase,
  UpdatePlaylistUseCase,
  UpdateQueuePositionsUseCase,
  UpdateSavedFilterUseCase,
} from './index';
import { GetActiveSessionsUseCase } from './scan-session/GetActiveSessions';
import { GetCompleteSessionsUseCase } from './scan-session/GetCompleteSessions';
import { StreamSessionUseCase } from './scan-session/StreamSession';
import {
  DisconnectProviderUseCase,
  ExchangeSpotifyCodeUseCase,
  ExchangeTidalCodeUseCase,
  ExchangeYouTubeCodeUseCase,
  GetConnectedProvidersUseCase,
  GetSpotifyAuthUrlUseCase,
  GetTidalAuthUrlUseCase,
  GetYouTubeAuthUrlUseCase,
  SyncPlaylistToSpotifyUseCase,
  SyncPlaylistToTidalUseCase,
  SyncPlaylistToYouTubeUseCase,
} from './third-party-sync';
import {
  GetAiServiceSettingsUseCase,
  SetAiServiceReplicasUseCase,
  TestAiServiceConnectionUseCase,
  UpdateAiServiceSettingsUseCase,
} from './ai-service';

const useCasesProviders = [
  createUseCaseProvider(GetTrackUseCase, [MUSIC_TRACK_REPOSITORY]),
  createUseCaseProvider(GetTracksUseCase, [MUSIC_TRACK_REPOSITORY]),
  createUseCaseProvider(AddImageSearchRecordUseCase, [
    IMAGE_SEARCH_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(ServeImageUseCase, [IMAGE_FILE_READER]),
  createUseCaseProvider(ServeTrackImageUseCase, [IMAGE_SEARCH_REPOSITORY]),
  createUseCaseProvider(CreatePlaylistUseCase, [
    PLAYLIST_REPOSITORY,
    MUSIC_TRACK_REPOSITORY,
    PLAYLIST_TRACK_REPOSITORY,
    PLAYLIST_SORTING_REPOSITORY,
    LOGGER,
  ]),
  createUseCaseProvider(GetPlaylistsUseCase, [PLAYLIST_REPOSITORY]),
  createUseCaseProvider(GetPlaylistUseCase, [PLAYLIST_REPOSITORY, PLAYLIST_SORTING_REPOSITORY]),
  createUseCaseProvider(UpdatePlaylistUseCase, [PLAYLIST_REPOSITORY]),
  createUseCaseProvider(DeletePlaylistUseCase, [PLAYLIST_REPOSITORY, LOGGER]),
  createUseCaseProvider(GetPlaylistStatsUseCase, [PLAYLIST_STATS_QUERY]),
  createUseCaseProvider(GetPlaylistTracksUseCase, [PLAYLIST_TRACK_REPOSITORY]),
  createUseCaseProvider(GetPlaylistsStatsUseCase, [PLAYLIST_STATS_QUERY]),
  createUseCaseProvider(GetPlaylistSortingByPlaylistIdUseCase, [PLAYLIST_SORTING_REPOSITORY]),
  createUseCaseProvider(GetPlaylistTracksWithDetailUseCase, [PLAYLIST_TRACK_REPOSITORY]),
  createUseCaseProvider(GetFavoriteUseCase, [PLAYLIST_REPOSITORY]),
  createUseCaseProvider(AddTrackToPlaylistUseCase, [
    PLAYLIST_TRACK_REPOSITORY,
    PLAYLIST_REPOSITORY,
    MUSIC_TRACK_REPOSITORY,
  ]),
  createUseCaseProvider(RemoveTrackFromPlaylistUseCase, [
    PLAYLIST_TRACK_REPOSITORY,
    PLAYLIST_REPOSITORY,
  ]),
  createUseCaseProvider(ExportPlaylistToM3UUseCase, [
    PLAYLIST_REPOSITORY,
    PLAYLIST_SORTING_REPOSITORY,
  ]),
  createUseCaseProvider(DownloadPlaylistToFolderUseCase, [
    PLAYLIST_REPOSITORY,
    PLAYLIST_SORTING_REPOSITORY,
    COPY_AUDIO_WITH_METADATA,
    IMAGE_SEARCH_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(UpdatePlaylistSortingUseCase, [PLAYLIST_SORTING_REPOSITORY]),
  createUseCaseProvider(UpdatePlaylistTracksPositionsUseCase, [
    PLAYLIST_TRACK_REPOSITORY,
    PLAYLIST_REPOSITORY,
  ]),
  createUseCaseProvider(GetStaticFilterOptionsUseCase, [SAVED_FILTER_QUERY]),
  createUseCaseProvider(CreateSavedFilterUseCase, [SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(GetActiveFiltersUseCase, [SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(DeleteSavedFilterUseCase, [SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(UpdateSavedFilterUseCase, [SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(GetCurrentFilterUseCase, [SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(GetQueueUseCase, [QUEUE_REPOSITORY]),
  createUseCaseProvider(AddTrackToQueueUseCase, [QUEUE_REPOSITORY, MUSIC_TRACK_REPOSITORY]),
  createUseCaseProvider(AddTracksToQueueUseCase, [QUEUE_REPOSITORY, MUSIC_TRACK_REPOSITORY]),
  createUseCaseProvider(RemoveTrackFromQueueUseCase, [QUEUE_REPOSITORY]),
  createUseCaseProvider(ResetQueueUseCase, [QUEUE_REPOSITORY]),
  createUseCaseProvider(UpdateQueuePositionsUseCase, [QUEUE_REPOSITORY]),
  createUseCaseProvider(GetHomeMetricsUseCase, [METRICS_QUERY]),
  createUseCaseProvider(GetWaveformDataUseCase, [AUDIO_WAVEFORM_GENERATOR, MUSIC_TRACK_REPOSITORY]),
  createUseCaseProvider(RecreateElasticsearchIndexUseCase, [TRACK_INDEXER_PORT]),
  createUseCaseProvider(SyncAllTracksToElasticsearchUseCase, [
    MUSIC_TRACK_REPOSITORY,
    TRACK_INDEXER_PORT,
    RECOMMENDATION_DATA_PORT,
  ]),
  createUseCaseProvider(SyncTrackToElasticSearchUseCase, [
    TRACK_INDEXER_PORT,
    MUSIC_TRACK_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(GetPlaylistRecommendationsUseCase, [
    RECOMMENDATION_SEARCH_PORT,
    PLAYLIST_TRACK_REPOSITORY,
    RECOMMENDATION_DATA_PORT,
    MUSIC_TRACK_REPOSITORY,
  ]),
  createUseCaseProvider(GetTrackRecommendationsUseCase, [
    RECOMMENDATION_SEARCH_PORT,
    MUSIC_TRACK_REPOSITORY,
    RECOMMENDATION_DATA_PORT,
  ]),
  createUseCaseProvider(GetRandomTrackIdUseCase, [MUSIC_TRACK_REPOSITORY]),
  createUseCaseProvider(CreateLibraryUseCase, [MUSIC_LIBRARY_REPOSITORY]),
  createUseCaseProvider(GetLibraryUseCase, [MUSIC_LIBRARY_REPOSITORY]),
  createUseCaseProvider(GetLibrariesUseCase, [MUSIC_LIBRARY_REPOSITORY]),
  createUseCaseProvider(DeleteLibraryUseCase, [MUSIC_LIBRARY_REPOSITORY]),
  createUseCaseProvider(GetTracksWithPaginationUseCase, [
    MUSIC_TRACK_REPOSITORY,
    SAVED_FILTER_REPOSITORY,
  ]),
  createUseCaseProvider(GetPendingTracksUseCase, [MUSIC_TRACK_REPOSITORY, SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(GetTracksWithCursorPaginationUseCase, [
    MUSIC_TRACK_REPOSITORY,
    SAVED_FILTER_REPOSITORY,
  ]),
  createUseCaseProvider(ToggleFavoriteUseCase, [
    MUSIC_TRACK_REPOSITORY,
    PLAYLIST_REPOSITORY,
    PLAYLIST_TRACK_REPOSITORY,
    HQ_AUDIO_ACQUIRE_PRODUCER,
  ]),
  createUseCaseProvider(ToggleLikeUseCase, [MUSIC_TRACK_REPOSITORY, HQ_AUDIO_ACQUIRE_PRODUCER]),
  createUseCaseProvider(AcquireHqAudioUseCase, [
    MUSIC_TRACK_REPOSITORY,
    HQ_AUDIO_ACQUIRER,
    HQ_AUDIO_TAGGER,
    LOGGER,
  ]),
  createUseCaseProvider(EnhanceHqAudioUseCase, [
    MUSIC_TRACK_REPOSITORY,
    HQ_AUDIO_ENHANCER,
    LOGGER,
    ConfigService,
  ]),
  createUseCaseProvider(ToggleDislikeUseCase, [
    MUSIC_TRACK_REPOSITORY,
    HIDDEN_MUSIC_TRACK_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(ToggleBangerUseCase, [MUSIC_TRACK_REPOSITORY, HQ_AUDIO_ACQUIRE_PRODUCER]),
  createUseCaseProvider(GetRandomTrackWithStatsUseCase, [MUSIC_TRACK_QUERIES]),
  createUseCaseProvider(GetRecentlyPlayedUseCase, [MUSIC_TRACK_REPOSITORY]),
  createUseCaseProvider(RegisterPlayedTrackUseCase, [MUSIC_TRACK_REPOSITORY]),
  createUseCaseProvider(HealthCheckUseCase, [HEALTH_QUERY]),
  createUseCaseProvider(ScheduleLibraryScanUseCase, [
    LIBRARY_SCAN_SCHEDULER_PRODUCER,
    MUSIC_LIBRARY_REPOSITORY,
    SCAN_SESSION_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(ProcessStartLibraryScanUseCase, [
    FILE_MANAGER,
    MUSIC_LIBRARY_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(ScheduleBatchAudioScanUseCase, [
    AUDIO_SCAN_SCHEDULER_PRODUCER,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(ScheduleSingleTrackScanUseCase, [
    MUSIC_TRACK_REPOSITORY,
    SCAN_SESSION_REPOSITORY,
    ScheduleBatchAudioScanUseCase,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(ScheduleIncompleteTracksScanUseCase, [
    MUSIC_TRACK_REPOSITORY,
    SCAN_SESSION_REPOSITORY,
    ScheduleBatchAudioScanUseCase,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(SchedulePlaylistTracksScanUseCase, [
    PLAYLIST_REPOSITORY,
    SCAN_SESSION_REPOSITORY,
    ScheduleBatchAudioScanUseCase,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(BackfillTrackEmbeddingsUseCase, [
    MUSIC_TRACK_REPOSITORY,
    EMBEDDING_BACKFILL_PRODUCER,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(ScheduleTracksByCriteriaScanUseCase, [
    MUSIC_TRACK_REPOSITORY,
    SCAN_SESSION_REPOSITORY,
    ScheduleBatchAudioScanUseCase,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(ProcessBatchAudioScanUseCase, [
    AUDIO_ANALYSIS_STRUCTURE,
    MUSIC_TRACK_REPOSITORY,
    SCAN_PROGRESS_PUBLISHER,
    LOGGER_FACTORY,
    LOGGER,
    SCAN_SESSION_REPOSITORY,
    MUSIC_LIBRARY_REPOSITORY,
  ]),
  createUseCaseProvider(ProcessEndLibraryScanUseCase, [
    SCAN_SESSION_REPOSITORY,
    SCAN_PROGRESS_PUBLISHER,
    MUSIC_LIBRARY_REPOSITORY,
    MUSIC_TRACK_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(ProcessEndBatchAudioScanUseCase, [
    SCAN_SESSION_REPOSITORY,
    SCAN_PROGRESS_PUBLISHER,
    LIBRARY_SCAN_SCHEDULER_PRODUCER,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(ProcessSingleTrackAnalysisUseCase, [
    MUSIC_TRACK_REPOSITORY,
    SCAN_PROGRESS_PUBLISHER,
    AUDIO_ANALYSIS_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(GetActiveSessionsUseCase, [
    SCAN_SESSION_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(GetCompleteSessionsUseCase, [
    SCAN_SESSION_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(StreamSessionUseCase, [
    SCAN_SESSION_REPOSITORY,
    SCAN_PROGRESS_SUBSCRIBER,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(StartHqAudioBatchDownloadUseCase, [
    PLAYLIST_REPOSITORY,
    PLAYLIST_SORTING_REPOSITORY,
    HQ_AUDIO_BATCH_PROGRESS_PUBLISHER,
    HQ_AUDIO_BATCH_ACQUIRE_PRODUCER,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(StreamHqAudioBatchProgressUseCase, [
    HQ_AUDIO_BATCH_PROGRESS_SUBSCRIBER,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(AcquireHqAudioBatchUseCase, [
    MUSIC_TRACK_REPOSITORY,
    TidalDlAcquirer,
    SockseekAcquirer,
    HQ_AUDIO_BATCH_PROGRESS_PUBLISHER,
    HQ_AUDIO_VERIFIER,
    HQ_AUDIO_TAGGER,
    ConfigService,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(StopLibraryScanUseCase, [
    MUSIC_LIBRARY_REPOSITORY,
    SCAN_SESSION_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(SyncPlaylistToYouTubeUseCase, [
    GetPlaylistUseCase,
    YOUTUBE_SYNC_PROVIDER,
    ID3_READER,
  ]),
  createUseCaseProvider(SyncPlaylistToTidalUseCase, [
    GetPlaylistUseCase,
    TIDAL_SYNC_PROVIDER,
    ID3_READER,
  ]),
  createUseCaseProvider(SyncPlaylistToSpotifyUseCase, [
    GetPlaylistUseCase,
    SPOTIFY_SYNC_PROVIDER,
    ID3_READER,
  ]),
  createUseCaseProvider(DiscoverSimilarTracksForPlaylistUseCase, [
    GetPlaylistUseCase,
    COSINE_PROVIDER,
    MUSIC_TRACK_REPOSITORY,
    YOUTUBE_SYNC_PROVIDER,
    COSINE_TRACK_MATCH_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(GetCosineRecommendationsForTrackUseCase, [
    MUSIC_TRACK_REPOSITORY,
    COSINE_PROVIDER,
    YOUTUBE_SYNC_PROVIDER,
    COSINE_TRACK_MATCH_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
  createUseCaseProvider(GetYouTubeAuthUrlUseCase, [YOUTUBE_SYNC_PROVIDER]),
  createUseCaseProvider(ExchangeYouTubeCodeUseCase, [YOUTUBE_SYNC_PROVIDER]),
  createUseCaseProvider(GetTidalAuthUrlUseCase, [TIDAL_SYNC_PROVIDER]),
  createUseCaseProvider(ExchangeTidalCodeUseCase, [TIDAL_SYNC_PROVIDER]),
  createUseCaseProvider(GetSpotifyAuthUrlUseCase, [SPOTIFY_SYNC_PROVIDER]),
  createUseCaseProvider(ExchangeSpotifyCodeUseCase, [SPOTIFY_SYNC_PROVIDER]),
  createUseCaseProvider(GetConnectedProvidersUseCase, [OAUTH_TOKEN_REPOSITORY]),
  createUseCaseProvider(DisconnectProviderUseCase, [OAUTH_TOKEN_REPOSITORY]),
  createUseCaseProvider(TestAiServiceConnectionUseCase, []),
  createUseCaseProvider(GetAiServiceSettingsUseCase, [AI_SERVICE_SETTINGS_REPOSITORY, AI_SERVICE_POOL]),
  createUseCaseProvider(UpdateAiServiceSettingsUseCase, [
    AI_SERVICE_SETTINGS_REPOSITORY,
    AI_SERVICE_POOL,
    SCAN_SESSION_REPOSITORY,
    TestAiServiceConnectionUseCase,
  ]),
  createUseCaseProvider(SetAiServiceReplicasUseCase, [
    AI_SERVICE_SETTINGS_REPOSITORY,
    AI_SERVICE_POOL,
    SCAN_SESSION_REPOSITORY,
    DOCKER_SCALING_SERVICE,
  ]),
];

@Module({
  imports: [
    ConfigModule,
    ThirdPartySyncInfrastructureModule,
    HqAudioInfrastructureModule,
    CosineInfrastructureModule,
  ],
  providers: useCasesProviders,
  exports: useCasesProviders.map((provider) => provider.provide),
})
export class UseCasesModule {}
