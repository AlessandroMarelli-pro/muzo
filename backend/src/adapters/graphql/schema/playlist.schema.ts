import { Field, ObjectType } from '@nestjs/graphql';
import { PlaylistId } from 'src/kernel/ids/scalars';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Node } from './common.schema';
import { PlaylistSorting } from './playlist-sorting.schema';
import { PlaylistStats } from './playlist-stats.schema';
import { PlaylistTrack } from './playlist-track.schema';
import { TrackRecommendation } from './recommendation.schema';

@ObjectType({ implements: () => [Node] })
export class Playlist {
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

  @Field(() => Boolean, {
    description: 'True if the given track is already in this playlist',
    nullable: true,
  })
  containsTrack?: boolean;

  @Field(() => PlaylistSorting, { nullable: true })
  sorting?: PlaylistSorting;

  @Field(() => [TrackRecommendation], { nullable: true })
  recommendations?: TrackRecommendation[];
}
