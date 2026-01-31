import { UseGuards } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { GetPlaylistTracksWithDetailUseCase } from 'src/clean-arch/application/use-cases/playlist-track/GetPlaylistTracksWithDetail';
import { SimpleMusicTrack } from 'src/modules/music-track/music-track.model';
import { AuthGuard } from '../context/auth.guard';
import { CleanArchPlaylistTrack as PlaylistTrack } from '../schema/playlist-track.schema';

@Resolver(() => PlaylistTrack)
@UseGuards(AuthGuard)
export class PlaylistTrackResolver {
  constructor(
    private readonly getPlaylistTracksWithDetailUseCase: GetPlaylistTracksWithDetailUseCase,
  ) {}

  @ResolveField(() => SimpleMusicTrack)
  async track(@Parent() parent: PlaylistTrack) {
    if (parent.track != null) {
      return parent.track;
    }
    return this.getPlaylistTracksWithDetailUseCase.execute(parent.playlistId);
  }
}
