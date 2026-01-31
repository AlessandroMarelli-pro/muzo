import { Inject } from '@nestjs/common';

import {
  IPlaylistStatsQuery,
  PLAYLIST_STATS_QUERY,
  PlaylistStatsDto,
} from '../../ports/queries/IPlaylistStatsQuery';

export class GetPlaylistsStatsUseCase {
  constructor(
    @Inject(PLAYLIST_STATS_QUERY)
    private readonly playlistStatsQuery: IPlaylistStatsQuery,
  ) {}

  async execute(): Promise<PlaylistStatsDto[]> {
    return this.playlistStatsQuery.getPlaylistsStats();
  }
}
