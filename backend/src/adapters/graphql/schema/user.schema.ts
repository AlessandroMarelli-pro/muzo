// user.schema.ts
import { Field, ObjectType } from '@nestjs/graphql';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Node } from './common.schema';
import { Library } from './library.schema';
import { ICursorPaginatedType, IPaginatedType } from './pagination.schema';
import { Playlist } from './playlist.schema';
import { QueueItem } from './queue-item.schema';
import { StaticFilterOptions } from './saved-filter.schema';
import { CursorPaginatedTracks, PaginatedTracks, Track } from './track.schema';

@ObjectType()
export class PlaylistsResult {
  @Field(() => [Playlist])
  items: Playlist[];
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

  @Field(() => [QueueItem])
  queue: QueueItem[];

  @Field(() => CursorPaginatedTracks)
  tracks: ICursorPaginatedType<Track>;

  @Field(() => [Library])
  libraries: Library[];

  @Field(() => PaginatedTracks)
  paginatedTracks: IPaginatedType<Track>;

  @Field(() => PaginatedTracks)
  pendingTracks: IPaginatedType<Track>;
}
