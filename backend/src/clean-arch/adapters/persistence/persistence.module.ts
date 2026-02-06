import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AUDIO_WAVEFORM_GENERATOR } from 'src/clean-arch/application/ports/infrastructure/IAudioWaveformGenerator';
import { IMAGE_FILE_READER } from 'src/clean-arch/application/ports/infrastructure/IImageFileReader';
import { METRICS_QUERY } from 'src/clean-arch/application/ports/queries/IMetricsQuery';
import { PLAYLIST_STATS_QUERY } from 'src/clean-arch/application/ports/queries/IPlaylistStatsQuery';
import { RECOMMENDATION_DATA_PORT } from 'src/clean-arch/application/ports/queries/IRecommendationDataPort';
import { SAVED_FILTER_QUERY } from 'src/clean-arch/application/ports/queries/ISavedFilterQuery';
import { IMAGE_SEARCH_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IImageSearchRepository';
import { MUSIC_LIBRARY_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IMusicLibraryRepository';
import { MUSIC_TRACK_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IMusicTrackRepository';
import { PLAYLIST_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IPlaylistRepository';
import { PLAYLIST_SORTING_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IPlaylistSortingRepository';
import { PLAYLIST_TRACK_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IPlaylistTrackRepository';
import { QUEUE_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IQueueRepository';
import { SAVED_FILTER_REPOSITORY } from 'src/clean-arch/application/ports/repositories/ISavedFilterRepository';
import { WaveformGenerator } from 'src/clean-arch/infrastructure/audio/waveform-generator';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { FileSystemImageReader } from '../../infrastructure/filesystem/image-file.reader';
import { MetricsQuery } from './queries/metrics/metrics.query';
import { PlaylistStatsQuery } from './queries/playlist/playlist-stats.query';
import { SavedFilterQuery } from './queries/saved-filter/saved-filter.query';
import { RecommendationDataAdapter } from './recommendation/recommendation-data.adapter';
import { ImageSearchRepository } from './repositories/image-search/image-search.repository';
import { MusicLibraryRepository } from './repositories/music-library/music-library.repository';
import { MusicTrackRepository } from './repositories/music-track/music-track.repository';
import { PlaylistSortingRepository } from './repositories/playlist-sorting/playlist-sorting.repository';
import { PlaylistTrackRepository } from './repositories/playlist-track/playlist-track.repository';
import { PlaylistRepository } from './repositories/playlist/playlist.repository';
import { QueueRepository } from './repositories/queue/queue.repository';
import { SavedFilterRepository } from './repositories/saved-filter/saved-filter.repository';

import { MusicTrackQuery } from './queries/music-track/music-track.query';
import { HiddenMusicTrackRepository } from './repositories/hidden-music-track/hidden-music-track.repository';

import { HEALTH_QUERY } from 'src/clean-arch/application/ports/queries/IHealthQuery';
import { MUSIC_TRACK_QUERIES } from 'src/clean-arch/application/ports/queries/IMusicTrackQueries';
import { HIDDEN_MUSIC_TRACK_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IHiddenMusicTrackRepository';
import { HealthQuery } from './queries/health/health.query';

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
  { provide: METRICS_QUERY, useClass: MetricsQuery },
  { provide: AUDIO_WAVEFORM_GENERATOR, useClass: WaveformGenerator },
  { provide: RECOMMENDATION_DATA_PORT, useClass: RecommendationDataAdapter },
  { provide: MUSIC_LIBRARY_REPOSITORY, useClass: MusicLibraryRepository },
  {
    provide: HIDDEN_MUSIC_TRACK_REPOSITORY,
    useClass: HiddenMusicTrackRepository,
  },
  { provide: MUSIC_TRACK_QUERIES, useClass: MusicTrackQuery },
  { provide: HEALTH_QUERY, useClass: HealthQuery },
];
@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService, ...queriesProviders],
  exports: queriesProviders.map((provider) => provider.provide),
})
export class AdaptersPersistenceModule {}
