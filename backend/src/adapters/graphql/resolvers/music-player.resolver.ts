import { UseGuards } from '@nestjs/common';
import { Args, Float, Mutation, ResolveField, Resolver } from '@nestjs/graphql';
import { GetWaveformDataUseCase, RegisterPlayedTrackUseCase } from 'src/application/use-cases';
import { parseMusicTrackId } from '../../common/utils/parse-id';
import { AuthGuard } from '../context/auth.guard';
import { Base64ID } from '../scalars/base64-id.scalar';
import { MusicPlayer } from '../schema/music-player.schema';

@Resolver(() => MusicPlayer)
@UseGuards(AuthGuard)
export class MusicPlayerResolver {
  constructor(
    private readonly getWaveformDataUseCase: GetWaveformDataUseCase,
    private readonly registerPlayedTrackUseCase: RegisterPlayedTrackUseCase,
  ) {}

  @ResolveField(() => [Float])
  async currentWaveformData(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<number[]> {
    return this.getWaveformDataUseCase.execute(parseMusicTrackId(trackId));
  }

  @Mutation(() => Boolean)
  async registerPlayedTrack(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<boolean> {
    return this.registerPlayedTrackUseCase.execute(parseMusicTrackId(trackId)).then(() => true);
  }
}
