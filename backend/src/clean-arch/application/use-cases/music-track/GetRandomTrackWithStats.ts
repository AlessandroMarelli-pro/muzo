import { Inject, Injectable } from '@nestjs/common';
import {
  IMusicTrackQueries,
  MUSIC_TRACK_QUERIES,
  RandomTrackWithStats,
} from '../../ports/queries/IMusicTrackQueries';

@Injectable()
export class GetRandomTrackWithStatsUseCase {
  constructor(
    @Inject(MUSIC_TRACK_QUERIES)
    private readonly musicTrackQueries: IMusicTrackQueries,
  ) {}

  async execute(): Promise<RandomTrackWithStats> {
    return this.musicTrackQueries.getRandomTrackWithStats();
  }
}
