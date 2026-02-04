import { Field, Float, InterfaceType, ObjectType } from '@nestjs/graphql';
import { extractModelId } from 'src/clean-arch/kernel/ids/factory';
import type { Model } from 'src/clean-arch/kernel/types/model-types';
import { Base64ID } from '../scalars/base64-id.scalar';

/** Relay-style global object identification. Fetch any entity by global ID via Query.node(id). */
@InterfaceType({
  resolveType(value: { id: string }) {
    const { modelName } = extractModelId(value.id as Model['id']);
    if (modelName === 'Playlist') return 'CleanArchPlaylist';
    if (modelName === 'User') return 'User';
    if (modelName === 'MusicTrack') return 'Track';
    return null;
  },
})
export abstract class Node {
  @Field(() => Base64ID)
  id: string;
}

// GraphQL Object Types
@ObjectType()
export class Range {
  @Field(() => Float)
  min: number;

  @Field(() => Float)
  max: number;
}
