import { Module } from '@nestjs/common';

import { PLAYLIST_STATS_QUERY } from 'src/clean-arch/application/ports/queries/IPlaylistStatsQuery';
import { PLAYLIST_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IPlaylistRepository';
import { PLAYLIST_SORTING_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IPlaylistSortingRepository';
import { PLAYLIST_TRACK_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IPlaylistTrackRepository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PlaylistStatsQuery } from '../queries/playlist-stats.query';
import { PlaylistSortingRepository } from './playlist-sorting/playlist-sorting.repository';
import { PlaylistTrackRepository } from './playlist-track/playlist-track.repository';
import { PlaylistRepository } from './playlist/playlist.repository';

@Module({
  providers: [
    PlaylistRepository,
    PrismaService,
    { provide: PLAYLIST_REPOSITORY, useClass: PlaylistRepository },
    { provide: PLAYLIST_TRACK_REPOSITORY, useClass: PlaylistTrackRepository },
    { provide: PLAYLIST_STATS_QUERY, useClass: PlaylistStatsQuery },
    {
      provide: PLAYLIST_SORTING_REPOSITORY,
      useClass: PlaylistSortingRepository,
    },
  ],
  exports: [
    PlaylistRepository,
    PLAYLIST_REPOSITORY,
    PLAYLIST_TRACK_REPOSITORY,
    PLAYLIST_STATS_QUERY,
    PLAYLIST_SORTING_REPOSITORY,
  ],
})
export class RepositoriesModule {}
