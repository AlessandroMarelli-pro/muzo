import { Args, Float, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MusicPlayerService, SeekRequest } from './music-player.service';
import { PlaybackState } from './music-player.types';

@Resolver()
export class MusicPlayerResolver {
  constructor(private readonly musicPlayerService: MusicPlayerService) {}

  @Query(() => PlaybackState, { nullable: true })
  async getPlaybackState(
    @Args('trackId') trackId: string,
  ): Promise<PlaybackState | null> {
    return this.musicPlayerService.getPlaybackState(trackId);
  }

  @Query(() => [Float])
  async getWaveformData(@Args('trackId') trackId: string): Promise<number[]> {
    return this.musicPlayerService.getWaveformData(trackId);
  }

  @Mutation(() => PlaybackState)
  async playTrack(
    @Args('trackId') trackId: string,
    @Args('startTime', { type: () => Float, defaultValue: 0 })
    startTime: number,
  ): Promise<PlaybackState> {
    const result = await this.musicPlayerService.playTrack(trackId, startTime);

    return result;
  }

  @Mutation(() => PlaybackState)
  async pauseTrack(@Args('trackId') trackId: string): Promise<PlaybackState> {
    const result = await this.musicPlayerService.pauseTrack(trackId);

    return result;
  }

  @Mutation(() => PlaybackState)
  async resumeTrack(@Args('trackId') trackId: string): Promise<PlaybackState> {
    const result = await this.musicPlayerService.resumeTrack(trackId);

    return result;
  }

  @Mutation(() => PlaybackState)
  async seekTrack(
    @Args('trackId') trackId: string,
    @Args('timeInSeconds') timeInSeconds: number,
  ): Promise<PlaybackState> {
    const seekRequest: SeekRequest = { trackId, timeInSeconds };
    const result = await this.musicPlayerService.seekTrack(seekRequest);

    return result;
  }

  @Mutation(() => Boolean)
  async stopTrack(@Args('trackId') trackId: string): Promise<boolean> {
    await this.musicPlayerService.stopTrack(trackId);

    return true;
  }

  @Mutation(() => PlaybackState)
  async setVolume(
    @Args('trackId') trackId: string,
    @Args('volume') volume: number,
  ): Promise<PlaybackState> {
    const result = await this.musicPlayerService.setVolume(trackId, volume);

    return result;
  }
}
