import { Args, Float, ResolveField, Resolver } from '@nestjs/graphql';
import { GetWaveformDataUseCase } from 'src/clean-arch/application/use-cases';
import { parseMusicTrackId } from '../../common/utils/parse-id';
import { Base64ID } from '../scalars/base64-id.scalar';
import { MusicPlayer } from '../schema/music-player.schema';

@Resolver(() => MusicPlayer)
export class MusicPlayerResolver {
  constructor(
    private readonly getWaveformDataUseCase: GetWaveformDataUseCase,
  ) {}

  @ResolveField(() => [Float])
  async currentWaveformData(
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ): Promise<number[]> {
    return this.getWaveformDataUseCase.execute(parseMusicTrackId(trackId));
  }
}
