import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AddTrackToPlaylistUseCase } from 'src/application/use-cases/playlist-track/AddTrackToPlaylist';
import { RemoveTrackFromPlaylistUseCase } from 'src/application/use-cases/playlist-track/RemoveTrackFromPlaylist';
import { UpdatePlaylistTracksPositionsUseCase } from 'src/application/use-cases/playlist-track/UpdatePlaylistTracksPositions';
import {
  parseMusicTrackId,
  parsePlaylistId,
} from '../../common/utils/parse-id';
import { AuthGuard } from '../context/auth.guard';
import { Base64ID } from '../scalars/base64-id.scalar';
import {
  AddTrackToPlaylistInput,
  UpdatePlaylistPositionsInput,
} from '../schema/playlist-track.input';
import { CleanArchPlaylistTrack } from '../schema/playlist-track.schema';

@Resolver(() => CleanArchPlaylistTrack)
@UseGuards(AuthGuard)
export class PlaylistTrackResolver {
  constructor(
    private readonly addTrackToPlaylistUseCase: AddTrackToPlaylistUseCase,
    private readonly removeTrackFromPlaylistUseCase: RemoveTrackFromPlaylistUseCase,
    private readonly updatePlaylistTracksPositionsUseCase: UpdatePlaylistTracksPositionsUseCase,
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

  @Mutation(() => Boolean)
  async updatePlaylistTracksPositions(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
    @Args('input') input: UpdatePlaylistPositionsInput,
  ) {
    return this.updatePlaylistTracksPositionsUseCase.execute(
      parsePlaylistId(playlistId),
      input.positions,
    );
  }
}
