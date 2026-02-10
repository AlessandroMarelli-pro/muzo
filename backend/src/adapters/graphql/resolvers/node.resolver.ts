import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { GetPlaylistUseCase, GetTrackUseCase } from 'src/application/use-cases';
import { GetLibraryUseCase } from 'src/application/use-cases/music-library/GetLibrary';
import { extractModelId } from 'src/kernel/ids/factory';
import { createNotFoundError } from 'src/kernel/types/errors';
import type { Model } from 'src/kernel/types/model-types';
import {
  parseMusicLibraryId,
  parseMusicTrackId,
  parsePlaylistId,
} from '../../common/utils/parse-id';
import { AuthGuard } from '../context/auth.guard';
import { toMusicLibrary } from '../mappers/music-library.mapper';
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
    private readonly getLibraryUseCase: GetLibraryUseCase,
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
    if (modelName === 'MusicLibrary') {
      return this.getLibraryUseCase
        .execute(parseMusicLibraryId(id))
        .then(toMusicLibrary);
    }
    if (modelName === 'User') {
      // Optional: add GetUserByIdUseCase and resolve here
      throw createNotFoundError(`User not found: ${id}`);
    }

    throw createNotFoundError(`Node not found: ${id}`);
  }
}
