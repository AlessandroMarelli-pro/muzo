import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AUDIO_ANALYSIS_STRUCTURE } from '../ports/infrastructure/IAudioAnalysisStructure';
import { AUDIO_SCAN_SCHEDULER_PRODUCER } from '../ports/infrastructure/IAudioScanSchedulerProducer';
import { AUDIO_WAVEFORM_GENERATOR } from '../ports/infrastructure/IAudioWaveformGenerator';
import { FILE_MANAGER } from '../ports/infrastructure/IFileManager';
import { IMAGE_FILE_READER } from '../ports/infrastructure/IImageFileReader';
import { LIBRARY_SCAN_SCHEDULER_PRODUCER } from '../ports/infrastructure/ILibraryScanSchedulerProducer';
import { LOGGER } from '../ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from '../ports/infrastructure/ILoggerFactory';
import { SCAN_PROGRESS_PUBLISHER } from '../ports/infrastructure/IScanProgressPublisher';
import { SCAN_PROGRESS_SUBSCRIBER } from '../ports/infrastructure/IScanProgressSubscriber';
import { HEALTH_QUERY } from '../ports/queries/IHealthQuery';
import { METRICS_QUERY } from '../ports/queries/IMetricsQuery';
import { MUSIC_TRACK_QUERIES } from '../ports/queries/IMusicTrackQueries';
import { PLAYLIST_STATS_QUERY } from '../ports/queries/IPlaylistStatsQuery';
import { RECOMMENDATION_DATA_PORT } from '../ports/queries/IRecommendationDataPort';
import { RECOMMENDATION_SEARCH_PORT } from '../ports/queries/IRecommendationSearchPort';
import { SAVED_FILTER_QUERY } from '../ports/queries/ISavedFilterQuery';
import { TRACK_INDEXER_PORT } from '../ports/queries/ITrackIndexerPort';
import { AUDIO_ANALYSIS_REPOSITORY } from '../ports/repositories/IAudioAnalysisRepository';
import { HIDDEN_MUSIC_TRACK_REPOSITORY } from '../ports/repositories/IHiddenMusicTrackRepository';
import { IMAGE_SEARCH_REPOSITORY } from '../ports/repositories/IImageSearchRepository';
import { MUSIC_LIBRARY_REPOSITORY } from '../ports/repositories/IMusicLibraryRepository';
import { MUSIC_TRACK_REPOSITORY } from '../ports/repositories/IMusicTrackRepository';
import { PLAYLIST_REPOSITORY } from '../ports/repositories/IPlaylistRepository';
import { PLAYLIST_SORTING_REPOSITORY } from '../ports/repositories/IPlaylistSortingRepository';
import { PLAYLIST_TRACK_REPOSITORY } from '../ports/repositories/IPlaylistTrackRepository';
import { QUEUE_REPOSITORY } from '../ports/repositories/IQueueRepository';
import { SAVED_FILTER_REPOSITORY } from '../ports/repositories/ISavedFilterRepository';
import { SCAN_SESSION_REPOSITORY } from '../ports/repositories/IScanSessionRepository';
import { createUseCaseProvider } from './create-use-case.provider';
import { HealthCheckUseCase } from './health/HealthCheck';
import {
  AddImageSearchRecordUseCase,
  AddTracksToQueueUseCase,
  AddTrackToPlaylistUseCase,
  AddTrackToQueueUseCase,
  CreateLibraryUseCase,
  CreatePlaylistUseCase,
  CreateSavedFilterUseCase,
  DeleteLibraryUseCase,
  DeletePlaylistUseCase,
  DeleteSavedFilterUseCase,
  ExportPlaylistToM3UUseCase,
  GetActiveFiltersUseCase,
  GetCurrentFilterUseCase,
  GetFavoriteUseCase,
  GetHomeMetricsUseCase,
  GetLibrariesUseCase,
  GetLibraryUseCase,
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
  GetSavedFilterUseCase,
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
  ScheduleLibraryScanUseCase,
  ServeImageUseCase,
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

const useCasesProviders = [
  createUseCaseProvider(GetTrackUseCase, [MUSIC_TRACK_REPOSITORY]),
  createUseCaseProvider(GetTracksUseCase, [MUSIC_TRACK_REPOSITORY]),
  createUseCaseProvider(AddImageSearchRecordUseCase, [
    IMAGE_SEARCH_REPOSITORY,
    ConfigService,
  ]),
  createUseCaseProvider(ServeImageUseCase, [IMAGE_FILE_READER]),
  createUseCaseProvider(CreatePlaylistUseCase, [
    PLAYLIST_REPOSITORY,
    MUSIC_TRACK_REPOSITORY,
    PLAYLIST_TRACK_REPOSITORY,
    PLAYLIST_SORTING_REPOSITORY,
    LOGGER,
  ]),
  createUseCaseProvider(GetPlaylistsUseCase, [PLAYLIST_REPOSITORY]),
  createUseCaseProvider(GetPlaylistUseCase, [
    PLAYLIST_REPOSITORY,
    PLAYLIST_SORTING_REPOSITORY,
  ]),
  createUseCaseProvider(UpdatePlaylistUseCase, [PLAYLIST_REPOSITORY]),
  createUseCaseProvider(DeletePlaylistUseCase, [PLAYLIST_REPOSITORY, LOGGER]),
  createUseCaseProvider(GetPlaylistStatsUseCase, [PLAYLIST_STATS_QUERY]),
  createUseCaseProvider(GetPlaylistTracksUseCase, [PLAYLIST_TRACK_REPOSITORY]),
  createUseCaseProvider(GetPlaylistsStatsUseCase, [PLAYLIST_STATS_QUERY]),
  createUseCaseProvider(GetPlaylistSortingByPlaylistIdUseCase, [
    PLAYLIST_SORTING_REPOSITORY,
  ]),
  createUseCaseProvider(GetPlaylistTracksWithDetailUseCase, [
    PLAYLIST_TRACK_REPOSITORY,
  ]),
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
  createUseCaseProvider(UpdatePlaylistSortingUseCase, [
    PLAYLIST_SORTING_REPOSITORY,
  ]),
  createUseCaseProvider(UpdatePlaylistTracksPositionsUseCase, [
    PLAYLIST_TRACK_REPOSITORY,
    PLAYLIST_REPOSITORY,
  ]),
  createUseCaseProvider(GetStaticFilterOptionsUseCase, [SAVED_FILTER_QUERY]),
  createUseCaseProvider(CreateSavedFilterUseCase, [SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(GetActiveFiltersUseCase, [SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(GetSavedFilterUseCase, [SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(DeleteSavedFilterUseCase, [SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(UpdateSavedFilterUseCase, [SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(GetCurrentFilterUseCase, [SAVED_FILTER_REPOSITORY]),
  createUseCaseProvider(GetQueueUseCase, [QUEUE_REPOSITORY]),
  createUseCaseProvider(AddTrackToQueueUseCase, [
    QUEUE_REPOSITORY,
    MUSIC_TRACK_REPOSITORY,
  ]),
  createUseCaseProvider(AddTracksToQueueUseCase, [
    QUEUE_REPOSITORY,
    MUSIC_TRACK_REPOSITORY,
  ]),
  createUseCaseProvider(RemoveTrackFromQueueUseCase, [QUEUE_REPOSITORY]),
  createUseCaseProvider(ResetQueueUseCase, [QUEUE_REPOSITORY]),
  createUseCaseProvider(UpdateQueuePositionsUseCase, [QUEUE_REPOSITORY]),
  createUseCaseProvider(GetHomeMetricsUseCase, [METRICS_QUERY]),
  createUseCaseProvider(GetWaveformDataUseCase, [
    AUDIO_WAVEFORM_GENERATOR,
    MUSIC_TRACK_REPOSITORY,
  ]),
  createUseCaseProvider(RecreateElasticsearchIndexUseCase, [
    TRACK_INDEXER_PORT,
  ]),
  createUseCaseProvider(SyncAllTracksToElasticsearchUseCase, [
    MUSIC_TRACK_REPOSITORY,
    TRACK_INDEXER_PORT,
    RECOMMENDATION_DATA_PORT,
  ]),
  createUseCaseProvider(SyncTrackToElasticSearchUseCase, [
    TRACK_INDEXER_PORT,
    MUSIC_TRACK_REPOSITORY,
    RECOMMENDATION_DATA_PORT,
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
  createUseCaseProvider(GetTracksWithCursorPaginationUseCase, [
    MUSIC_TRACK_REPOSITORY,
    SAVED_FILTER_REPOSITORY,
  ]),
  createUseCaseProvider(ToggleFavoriteUseCase, [
    MUSIC_TRACK_REPOSITORY,
    PLAYLIST_REPOSITORY,
    PLAYLIST_TRACK_REPOSITORY,
  ]),
  createUseCaseProvider(ToggleLikeUseCase, [MUSIC_TRACK_REPOSITORY]),
  createUseCaseProvider(ToggleDislikeUseCase, [
    MUSIC_TRACK_REPOSITORY,
    HIDDEN_MUSIC_TRACK_REPOSITORY,
  ]),
  createUseCaseProvider(ToggleBangerUseCase, [MUSIC_TRACK_REPOSITORY]),
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
  createUseCaseProvider(StopLibraryScanUseCase, [
    MUSIC_LIBRARY_REPOSITORY,
    SCAN_SESSION_REPOSITORY,
    LOGGER_FACTORY,
    LOGGER,
  ]),
];

@Module({
  imports: [ConfigModule],
  providers: useCasesProviders,
  exports: useCasesProviders.map((provider) => provider.provide),
})
export class UseCasesModule {}
