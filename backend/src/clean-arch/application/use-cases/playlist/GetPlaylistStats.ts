import { Inject, Injectable } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids/scalars';

import {
  IPlaylistStatsQuery,
  PLAYLIST_STATS_QUERY,
  PlaylistStatsDto,
} from '../../ports/queries/IPlaylistStatsQuery';

@Injectable()
export class GetPlaylistStatsUseCase {
  constructor(
    @Inject(PLAYLIST_STATS_QUERY)
    private readonly playlistStatsQuery: IPlaylistStatsQuery,
  ) {}

  async execute(playlistId: PlaylistId): Promise<PlaylistStatsDto> {
    return this.playlistStatsQuery.getPlaylistStats(playlistId);
  }
}
