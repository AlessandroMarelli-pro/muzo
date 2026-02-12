import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AUDIO_WAVEFORM_GENERATOR } from 'src/application/ports/infrastructure/IAudioWaveformGenerator';
import { ID3_READER } from 'src/application/ports/infrastructure/IId3Reader';
import { IMAGE_FILE_READER } from 'src/application/ports/infrastructure/IImageFileReader';
import { METRICS_QUERY } from 'src/application/ports/queries/IMetricsQuery';
import { PLAYLIST_STATS_QUERY } from 'src/application/ports/queries/IPlaylistStatsQuery';
import { RECOMMENDATION_DATA_PORT } from 'src/application/ports/queries/IRecommendationDataPort';
import { SAVED_FILTER_QUERY } from 'src/application/ports/queries/ISavedFilterQuery';
import { IMAGE_SEARCH_REPOSITORY } from 'src/application/ports/repositories/IImageSearchRepository';
import { MUSIC_LIBRARY_REPOSITORY } from 'src/application/ports/repositories/IMusicLibraryRepository';
import { MUSIC_TRACK_REPOSITORY } from 'src/application/ports/repositories/IMusicTrackRepository';
import { OAUTH_TOKEN_REPOSITORY } from 'src/application/ports/repositories/IOAuthTokenRepository';
import { PLAYLIST_REPOSITORY } from 'src/application/ports/repositories/IPlaylistRepository';
import { PLAYLIST_SORTING_REPOSITORY } from 'src/application/ports/repositories/IPlaylistSortingRepository';
import { PLAYLIST_TRACK_REPOSITORY } from 'src/application/ports/repositories/IPlaylistTrackRepository';
import { QUEUE_REPOSITORY } from 'src/application/ports/repositories/IQueueRepository';
import { SAVED_FILTER_REPOSITORY } from 'src/application/ports/repositories/ISavedFilterRepository';
import { WaveformGenerator } from 'src/infrastructure/audio/waveform-generator';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Id3ReaderAdapter } from '../../infrastructure/filesystem/id3-reader.adapter';
import { FileSystemImageReader } from '../../infrastructure/filesystem/image-file.reader';
import { MetricsQuery } from './queries/metrics/metrics.query';
import { PlaylistStatsQuery } from './queries/playlist/playlist-stats.query';
import { SavedFilterQuery } from './queries/saved-filter/saved-filter.query';
import { RecommendationDataAdapter } from './recommendation/recommendation-data.adapter';
import { ImageSearchRepository } from './repositories/image-search/image-search.repository';
import { MusicLibraryRepository } from './repositories/music-library/music-library.repository';
import { MusicTrackRepository } from './repositories/music-track/music-track.repository';
import { OAuthTokenRepository } from './repositories/oauth-token/oauth-token.repository';
import { PlaylistSortingRepository } from './repositories/playlist-sorting/playlist-sorting.repository';
import { PlaylistTrackRepository } from './repositories/playlist-track/playlist-track.repository';
import { PlaylistRepository } from './repositories/playlist/playlist.repository';
import { QueueRepository } from './repositories/queue/queue.repository';
import { SavedFilterRepository } from './repositories/saved-filter/saved-filter.repository';

import { FILE_MANAGER } from 'src/application/ports/infrastructure/IFileManager';
import { SCAN_PROGRESS_PUBLISHER } from 'src/application/ports/infrastructure/IScanProgressPublisher';
import { SCAN_PROGRESS_SUBSCRIBER } from 'src/application/ports/infrastructure/IScanProgressSubscriber';
import { HEALTH_QUERY } from 'src/application/ports/queries/IHealthQuery';
import { MUSIC_TRACK_QUERIES } from 'src/application/ports/queries/IMusicTrackQueries';
import { AUDIO_ANALYSIS_REPOSITORY } from 'src/application/ports/repositories/IAudioAnalysisRepository';
import { HIDDEN_MUSIC_TRACK_REPOSITORY } from 'src/application/ports/repositories/IHiddenMusicTrackRepository';
import { SCAN_SESSION_REPOSITORY } from 'src/application/ports/repositories/IScanSessionRepository';
import { FileManager } from 'src/infrastructure/filesystem/file.manager';
import { ScanProgressPubSubAdapter } from 'src/infrastructure/pubsub/scan-progress-pubsub.adapter';
import { HealthQuery } from './queries/health/health.query';
import { MusicTrackQuery } from './queries/music-track/music-track.query';
import { AudioAnalysisRepository } from './repositories/audio-analysis/audio-analysis.repository';
import { HiddenMusicTrackRepository } from './repositories/hidden-music-track/hidden-music-track.repository';
import { ScanSessionRepository } from './repositories/scan-session/scan-session.repository';

const queriesProviders = [
  { provide: PLAYLIST_REPOSITORY, useClass: PlaylistRepository },
  { provide: PLAYLIST_TRACK_REPOSITORY, useClass: PlaylistTrackRepository },
  { provide: PLAYLIST_STATS_QUERY, useClass: PlaylistStatsQuery },
  {
    provide: PLAYLIST_SORTING_REPOSITORY,
    useClass: PlaylistSortingRepository,
  },
  { provide: MUSIC_TRACK_REPOSITORY, useClass: MusicTrackRepository },
  { provide: QUEUE_REPOSITORY, useClass: QueueRepository },
  { provide: SAVED_FILTER_QUERY, useClass: SavedFilterQuery },
  { provide: SAVED_FILTER_REPOSITORY, useClass: SavedFilterRepository },
  { provide: IMAGE_SEARCH_REPOSITORY, useClass: ImageSearchRepository },
  { provide: IMAGE_FILE_READER, useClass: FileSystemImageReader },
  { provide: ID3_READER, useClass: Id3ReaderAdapter },
  { provide: METRICS_QUERY, useClass: MetricsQuery },
  { provide: OAUTH_TOKEN_REPOSITORY, useClass: OAuthTokenRepository },
  { provide: AUDIO_WAVEFORM_GENERATOR, useClass: WaveformGenerator },
  { provide: RECOMMENDATION_DATA_PORT, useClass: RecommendationDataAdapter },
  { provide: MUSIC_LIBRARY_REPOSITORY, useClass: MusicLibraryRepository },
  {
    provide: HIDDEN_MUSIC_TRACK_REPOSITORY,
    useClass: HiddenMusicTrackRepository,
  },
  { provide: MUSIC_TRACK_QUERIES, useClass: MusicTrackQuery },
  { provide: HEALTH_QUERY, useClass: HealthQuery },
  { provide: FILE_MANAGER, useClass: FileManager },
  { provide: AUDIO_ANALYSIS_REPOSITORY, useClass: AudioAnalysisRepository },
  { provide: SCAN_SESSION_REPOSITORY, useClass: ScanSessionRepository },
  { provide: SCAN_PROGRESS_PUBLISHER, useClass: ScanProgressPubSubAdapter },
  { provide: SCAN_PROGRESS_SUBSCRIBER, useClass: ScanProgressPubSubAdapter },
];
@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService, ...queriesProviders],
  exports: queriesProviders.map((provider) => provider.provide),
})
export class AdaptersPersistenceModule {}
