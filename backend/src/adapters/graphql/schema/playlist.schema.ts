import { Field, ObjectType } from '@nestjs/graphql';
import { Maybe } from 'src/kernel/common';
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

  @Field(() => String, { nullable: true })
  description: Maybe<string>;

  @Field()
  isPublic: boolean;

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  updatedAt?: Date;

  @Field(() => Base64ID)
  createdById: string;

  @Field(() => [PlaylistTrack], { nullable: true })
  tracks?: Maybe<PlaylistTrack[]>;

  @Field(() => PlaylistStats, { nullable: true })
  stats?: Maybe<PlaylistStats>;

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
