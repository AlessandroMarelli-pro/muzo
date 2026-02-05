import { Injectable } from '@nestjs/common';
import {
  IMusicTrackQueries,
  RandomTrackWithStats,
} from '../../ports/queries/IMusicTrackQueries';

@Injectable()
export class GetRandomTrackWithStatsUseCase {
  constructor(private readonly musicTrackQueries: IMusicTrackQueries) {}

  async execute(): Promise<RandomTrackWithStats> {
    return this.musicTrackQueries.getRandomTrackWithStats();
  }
}
