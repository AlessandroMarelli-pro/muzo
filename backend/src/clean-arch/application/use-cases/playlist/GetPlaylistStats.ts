import { PlaylistId } from 'src/clean-arch/kernel/ids/scalars';

import {
  IPlaylistStatsQuery,
  PlaylistStatsDto,
} from '../../ports/queries/IPlaylistStatsQuery';

export class GetPlaylistStatsUseCase {
  constructor(private readonly playlistStatsQuery: IPlaylistStatsQuery) {}

  async execute(playlistId: PlaylistId): Promise<PlaylistStatsDto> {
    return this.playlistStatsQuery.getPlaylistStats(playlistId);
  }
}
