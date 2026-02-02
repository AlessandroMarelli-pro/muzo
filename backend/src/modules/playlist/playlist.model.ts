import { Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Range } from 'src/clean-arch/adapters/graphql/schema/common.schema';

import { SimpleMusicTrack } from '../music-track/music-track.model';
@ObjectType()
export class PlaylistTrack {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  position: number;

  @Field()
  addedAt: string;

  @Field(() => SimpleMusicTrack)
  track: SimpleMusicTrack;
}

@ObjectType()
export class PlaylistStats {
  @Field(() => Int)
  totalTracks: number;

  @Field(() => Int)
  totalDuration: number;

  @Field(() => Int)
  averageDuration: number;

  @Field(() => String, { nullable: true })
  genreDistribution?: string; // JSON string
}

@ObjectType()
export class TrackRecommendation {
  @Field(() => SimpleMusicTrack)
  track: SimpleMusicTrack;

  @Field(() => Float)
  similarity: number;

  @Field(() => [String])
  reasons: string[];
}

@InputType()
export class UpdatePlaylistInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  isPublic?: boolean;
}

@InputType()
export class TrackOrderInput {
  @Field(() => ID)
  trackId: string;

  @Field(() => Int)
  position: number;
}

@InputType()
export class ReorderTracksInput {
  @Field(() => [TrackOrderInput])
  trackOrders: TrackOrderInput[];
}

@InputType()
export class UpdatePlaylistSortingInput {
  @Field()
  sortingKey: string;

  @Field()
  sortingDirection: string;
}

@ObjectType()
export class PlaylistItem {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Range)
  bpmRange: Range;

  @Field(() => Range)
  energyRange: Range;

  @Field(() => Int)
  genresCount: number;

  @Field(() => Int)
  subgenresCount: number;

  @Field(() => [String])
  topGenres: string[];

  @Field(() => [String])
  topSubgenres: string[];

  @Field(() => Int)
  numberOfTracks: number;

  @Field(() => Float)
  totalDuration: number;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  //images
  @Field(() => [String])
  images: string[];

  @Field(() => Boolean, { nullable: true })
  isTrackInPlaylist?: boolean;
}

@ObjectType()
export class PlaylistSorting {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  playlistId: string;

  @Field()
  sortingKey: string;

  @Field()
  sortingDirection: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class Playlist extends PlaylistItem {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => [PlaylistTrack])
  tracks: PlaylistTrack[];

  @Field(() => PlaylistSorting, { nullable: true })
  sorting?: PlaylistSorting;
}
