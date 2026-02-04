import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  GetPlaylistUseCase,
  GetTrackUseCase,
} from 'src/clean-arch/application/use-cases';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import { createNotFoundError } from 'src/clean-arch/kernel/types/errors';
import type { Model } from 'src/clean-arch/kernel/types/model-types';
import {
  parseMusicTrackId,
  parsePlaylistId,
} from '../../common/utils/parse-id';
import { AuthGuard } from '../context/auth.guard';
import { toTrack } from '../mappers/track.mapper';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Node } from '../schema/common.schema';

/**
 * Resolver for Relay-style global object identification.
 * Use Query.node(id) to fetch any entity by global ID instead of type-specific queries like playlist(id).
 *
 * Example:
 *   query { node(id: "Playlist:abc") { ... on CleanArchPlaylist { id name tracks { track { id title } } } } }
 */
@Resolver(() => Node)
@UseGuards(AuthGuard)
export class NodeResolver {
  constructor(
    private readonly getPlaylistUseCase: GetPlaylistUseCase,
    private readonly getTrackUseCase: GetTrackUseCase,
  ) {}

  @Query(() => Node, {
    nullable: true,
    description:
      'Fetch any node by global ID. Use inline fragments (... on CleanArchPlaylist { ... }) to request fields.',
  })
  async node(
    @Args('id', { type: () => Base64ID }) id: string,
  ): Promise<{ id: string } | null> {
    const { modelName } = extractModelId(id as Model['id']);

    if (modelName === 'Playlist') {
      return this.getPlaylistUseCase
        .execute(parsePlaylistId(id))
        .then((playlist) => ({
          ...playlist,
          tracks: playlist.tracks.map((track) => ({
            ...track,
            track: toTrack(track.track),
          })),
        }));
    }
    if (modelName === 'MusicTrack') {
      return this.getTrackUseCase.execute(parseMusicTrackId(id)).then(toTrack);
    }
    if (modelName === 'User') {
      // Optional: add GetUserByIdUseCase and resolve here
      throw createNotFoundError(`User not found: ${id}`);
    }

    throw createNotFoundError(`Node not found: ${id}`);
  }
}
