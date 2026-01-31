import { Field, ObjectType } from '@nestjs/graphql';
import { PlaylistId } from 'src/clean-arch/kernel/ids/scalars';
import { Base64ID } from '../scalars/base64-id.scalar';
import { CleanArchPlaylistStats as PlaylistStats } from './playlist-stats.schema';
import { CleanArchPlaylistTrack as PlaylistTrack } from './playlist-track.schema';

@ObjectType()
export class CleanArchPlaylist {
  @Field(() => Base64ID)
  id: PlaylistId;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  isPublic: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Base64ID)
  createdById: string;

  @Field(() => Base64ID, { nullable: true })
  updatedById: string;

  @Field(() => [PlaylistTrack], { nullable: true })
  tracks?: PlaylistTrack[];

  @Field(() => PlaylistStats, { nullable: true })
  stats?: PlaylistStats;
  /*
  @Field(() => PlaylistSorting, { nullable: true })
  sorting?: PlaylistSorting;
 */
}
