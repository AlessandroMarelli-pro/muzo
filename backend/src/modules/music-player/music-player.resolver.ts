import { Args, Float, Query, Resolver } from '@nestjs/graphql';
import { MusicPlayerService } from './music-player.service';

@Resolver()
export class MusicPlayerResolver {
  constructor(private readonly musicPlayerService: MusicPlayerService) {}

  @Query(() => [Float])
  async getWaveformData(@Args('trackId') trackId: string): Promise<number[]> {
    return this.musicPlayerService.getWaveformData(trackId);
  }
}
