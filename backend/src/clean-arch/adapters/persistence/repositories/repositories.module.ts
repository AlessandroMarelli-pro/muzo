import { Global, Module } from '@nestjs/common';

import { PLAYLIST_STATS_QUERY } from 'src/clean-arch/application/ports/queries/IPlaylistStatsQuery';
import { SAVED_FILTER_QUERY } from 'src/clean-arch/application/ports/queries/ISavedFilterQuery';
import { MUSIC_TRACK_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IMusicTrackRepository';
import { PLAYLIST_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IPlaylistRepository';
import { PLAYLIST_SORTING_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IPlaylistSortingRepository';
import { PLAYLIST_TRACK_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IPlaylistTrackRepository';
import { SAVED_FILTER_REPOSITORY } from 'src/clean-arch/application/ports/repositories/ISavedFilterRepository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PlaylistStatsQuery } from '../queries/playlist/playlist-stats.query';
import { SavedFilterQuery } from '../queries/saved-filter/saved-filter.query';
import { MusicTrackRepository } from './music-track/music-track.repository';
import { PlaylistSortingRepository } from './playlist-sorting/playlist-sorting.repository';
import { PlaylistTrackRepository } from './playlist-track/playlist-track.repository';
import { PlaylistRepository } from './playlist/playlist.repository';
import { SavedFilterRepository } from './saved-filter/saved-filter.repository';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: PLAYLIST_REPOSITORY, useClass: PlaylistRepository },
    { provide: PLAYLIST_TRACK_REPOSITORY, useClass: PlaylistTrackRepository },
    { provide: PLAYLIST_STATS_QUERY, useClass: PlaylistStatsQuery },
    {
      provide: PLAYLIST_SORTING_REPOSITORY,
      useClass: PlaylistSortingRepository,
    },
    { provide: MUSIC_TRACK_REPOSITORY, useClass: MusicTrackRepository },
    { provide: SAVED_FILTER_QUERY, useClass: SavedFilterQuery },
    { provide: SAVED_FILTER_REPOSITORY, useClass: SavedFilterRepository },
  ],
  exports: [
    PLAYLIST_REPOSITORY,
    PLAYLIST_TRACK_REPOSITORY,
    PLAYLIST_STATS_QUERY,
    PLAYLIST_SORTING_REPOSITORY,
    MUSIC_TRACK_REPOSITORY,
    SAVED_FILTER_QUERY,
    SAVED_FILTER_REPOSITORY,
  ],
})
export class RepositoriesModule {}
