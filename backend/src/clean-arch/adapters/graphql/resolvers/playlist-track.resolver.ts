import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AddTrackToPlaylistUseCase } from 'src/clean-arch/application/use-cases/playlist-track/AddTrackToPlaylist';
import { RemoveTrackFromPlaylistUseCase } from 'src/clean-arch/application/use-cases/playlist-track/RemoveTrackFromPlaylist';
import { AuthGuard } from '../context/auth.guard';
import { Base64ID } from '../scalars/base64-id.scalar';
import { AddTrackToPlaylistInput } from '../schema/playlist-track.input';
import { CleanArchPlaylistTrack } from '../schema/playlist-track.schema';
import { parseMusicTrackId, parsePlaylistId } from '../utils/parse-id';

@Resolver(() => CleanArchPlaylistTrack)
@UseGuards(AuthGuard)
export class PlaylistTrackResolver {
  constructor(
    private readonly addTrackToPlaylistUseCase: AddTrackToPlaylistUseCase,
    private readonly removeTrackFromPlaylistUseCase: RemoveTrackFromPlaylistUseCase,
  ) {}

  @Mutation(() => CleanArchPlaylistTrack)
  async addTrackToPlaylist(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
    @Args('input') input: AddTrackToPlaylistInput,
  ) {
    return this.addTrackToPlaylistUseCase.execute(parsePlaylistId(playlistId), {
      trackId: parseMusicTrackId(input.trackId),
      position: input.position,
    });
  }
  @Mutation(() => Boolean)
  async removeTrackFromPlaylist(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
    @Args('trackId', { type: () => Base64ID }) trackId: string,
  ) {
    return this.removeTrackFromPlaylistUseCase.execute(
      parsePlaylistId(playlistId),
      parseMusicTrackId(trackId),
    );
  }
}
