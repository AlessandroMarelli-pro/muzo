// user.schema.ts
import { Field, ObjectType } from '@nestjs/graphql';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Node } from './common.schema';
import { CleanArchPlaylist } from './playlist.schema';
import { StaticFilterOptions } from './saved-filter.schema';

@ObjectType()
export class PlaylistsResult {
  @Field(() => [CleanArchPlaylist])
  items: CleanArchPlaylist[];
}

@ObjectType({ implements: () => [Node] })
export class User {
  @Field(() => Base64ID)
  id: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field(() => PlaylistsResult)
  playlists: PlaylistsResult;

  @Field(() => StaticFilterOptions)
  staticFilterOptions: StaticFilterOptions;
}
