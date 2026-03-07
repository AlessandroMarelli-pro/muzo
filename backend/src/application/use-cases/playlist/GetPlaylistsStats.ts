import { IPlaylistStatsQuery, PlaylistStatsDto } from '../../ports/queries/IPlaylistStatsQuery';

export class GetPlaylistsStatsUseCase {
  constructor(private readonly playlistStatsQuery: IPlaylistStatsQuery) {}

  async execute(): Promise<PlaylistStatsDto[]> {
    return this.playlistStatsQuery.getPlaylistsStats();
  }
}
