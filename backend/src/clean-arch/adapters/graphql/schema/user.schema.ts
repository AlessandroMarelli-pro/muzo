// user.schema.ts
import { Field, ObjectType } from '@nestjs/graphql';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Node } from './common.schema';
import { Library } from './library.schema';
import { CleanArchPlaylist } from './playlist.schema';
import { CleanArchQueueItem } from './queue-item.schema';
import { StaticFilterOptions } from './saved-filter.schema';
import { Track } from './track.schema';

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

  @Field(() => [CleanArchQueueItem])
  queue: CleanArchQueueItem[];

  @Field(() => [Track])
  tracks: Track[];

  @Field(() => [Library])
  libraries: Library[];
}
