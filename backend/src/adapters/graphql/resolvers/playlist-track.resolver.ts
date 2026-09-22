import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Resolver } from '@nestjs/graphql';
import { AddTrackToPlaylistUseCase } from 'src/application/use-cases/playlist-track/AddTrackToPlaylist';
import { LookupBandcampUrlsForPlaylistUseCase } from 'src/application/use-cases/playlist-track/LookupBandcampUrlsForPlaylist';
import { LookupDiscogsUrlsForPlaylistUseCase } from 'src/application/use-cases/playlist-track/LookupDiscogsUrlsForPlaylist';
import { RemoveTrackFromPlaylistUseCase } from 'src/application/use-cases/playlist-track/RemoveTrackFromPlaylist';
import { UpdatePlaylistTracksPositionsUseCase } from 'src/application/use-cases/playlist-track/UpdatePlaylistTracksPositions';
import { getCurrentUser } from 'src/kernel/types/context';
import { parseMusicTrackId, parsePlaylistId } from '../../common/utils/parse-id';
import { AuthGuard } from '../context/auth.guard';
import { Base64ID } from '../scalars/base64-id.scalar';
import {
  AddTrackToPlaylistInput,
  UpdatePlaylistPositionsInput,
} from '../schema/playlist-track.input';
import { PlaylistTrack } from '../schema/playlist-track.schema';

@Resolver(() => PlaylistTrack)
@UseGuards(AuthGuard)
export class PlaylistTrackResolver {
  constructor(
    private readonly addTrackToPlaylistUseCase: AddTrackToPlaylistUseCase,
    private readonly removeTrackFromPlaylistUseCase: RemoveTrackFromPlaylistUseCase,
    private readonly updatePlaylistTracksPositionsUseCase: UpdatePlaylistTracksPositionsUseCase,
    private readonly lookupBandcampUrlsForPlaylistUseCase: LookupBandcampUrlsForPlaylistUseCase,
    private readonly lookupDiscogsUrlsForPlaylistUseCase: LookupDiscogsUrlsForPlaylistUseCase,
  ) {}

  @Mutation(() => PlaylistTrack)
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

  @Mutation(() => Int)
  async lookupBandcampUrlsForPlaylist(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
  ): Promise<number> {
    return this.lookupBandcampUrlsForPlaylistUseCase.execute(
      parsePlaylistId(playlistId),
      getCurrentUser(),
    );
  }

  @Mutation(() => Int)
  async lookupDiscogsUrlsForPlaylist(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
  ): Promise<number> {
    return this.lookupDiscogsUrlsForPlaylistUseCase.execute(
      parsePlaylistId(playlistId),
      getCurrentUser(),
    );
  }
}
