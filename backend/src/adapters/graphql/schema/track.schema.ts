import { Field, Float, ObjectType } from '@nestjs/graphql';
import { MaybeUndefined } from 'src/kernel/common';
import { MusicLibraryId, MusicTrackId } from 'src/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Node } from './common.schema';
import { CursorPaginated, Paginated } from './pagination.schema';

@ObjectType()
export class TrackStats {
  @Field(() => Float)
  listeningCount: number;
  @Field(() => Date, { nullable: true })
  lastPlayedAt?: Date;
  @Field(() => Boolean)
  isFavorite: boolean;
  @Field(() => Boolean)
  isLiked: boolean;
  @Field(() => Boolean)
  isBanger: boolean;
}

@ObjectType()
export class TrackFileInfo {
  @Field(() => String)
  filePath: string;
  @Field(() => String)
  fileName: string;
  @Field(() => Float)
  fileSize: number;
  @Field(() => Date)
  fileCreatedAt: Date;
}

@ObjectType()
export class TrackTechnicalInfo {
  @Field(() => Float)
  duration: number;
  @Field(() => String)
  format: string;
}

@ObjectType()
export class TrackMetadata {
  @Field(() => String, { nullable: true })
  album?: string;

  @Field(() => Date, { nullable: true })
  date?: Date;

  @Field(() => [String], { nullable: true })
  genres?: string[];

  @Field(() => [String], { nullable: true })
  subgenres?: string[];
}

@ObjectType()
export class TrackAIMetadata {
  @Field(() => [String], { nullable: true })
  tags?: string[];
  @Field(() => String, { nullable: true })
  vocalsDesc?: string;
  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  vocalsDescriptions?: string;

  @Field(() => [String], { nullable: true })
  atmosphereKeywords?: string[];

  @Field(() => String, { nullable: true })
  contextBackgrounds?: string;

  @Field(() => String, { nullable: true })
  contextImpacts?: string;
}

@ObjectType()
export class TrackMusicalFeatures {
  @Field(() => Float, { nullable: true })
  tempo?: number;

  @Field(() => String, { nullable: true })
  key?: string;

  @Field(() => String, { nullable: true })
  valenceMood?: string;

  @Field(() => String, { nullable: true })
  arousalMood?: string;

  @Field(() => String, { nullable: true })
  danceabilityFeeling?: string;

  @Field(() => Float, { nullable: true })
  acousticness?: number;

  @Field(() => Float, { nullable: true })
  instrumentalness?: number;

  @Field(() => Float, { nullable: true })
  speechiness?: number;
}

@ObjectType({ implements: () => [Node] })
export class Track {
  @Field(() => Base64ID)
  id: MusicTrackId;

  @Field(() => String, { nullable: true })
  artist: MaybeUndefined<string>;

  @Field(() => String, { nullable: true })
  title: MaybeUndefined<string>;

  @Field(() => TrackStats, { nullable: true })
  stats: MaybeUndefined<TrackStats>;

  @Field(() => TrackFileInfo, { nullable: true })
  fileInfo: MaybeUndefined<TrackFileInfo>;

  @Field(() => TrackTechnicalInfo, { nullable: true })
  technicalInfo: MaybeUndefined<TrackTechnicalInfo>;

  @Field(() => TrackMetadata, { nullable: true })
  metadata: MaybeUndefined<TrackMetadata>;

  @Field(() => TrackAIMetadata, { nullable: true })
  aiMetadata: MaybeUndefined<TrackAIMetadata>;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  updatedAt?: Date;

  @Field(() => TrackMusicalFeatures, { nullable: true })
  musicalFeatures: MaybeUndefined<TrackMusicalFeatures>;

  @Field({ nullable: true })
  imagePath?: string;

  @Field(() => Date, { nullable: true })
  lastScannedAt?: Date;

  @Field(() => Base64ID, { nullable: true })
  libraryId: MusicLibraryId;
}

@ObjectType()
export class PaginatedTracks extends Paginated(Track) {}

@ObjectType()
export class CursorPaginatedTracks extends CursorPaginated(Track) {}

@ObjectType()
export class RandomTrackWithStats {
  @Field(() => Track, { nullable: true })
  track: Track | null;

  @Field(() => Float)
  likedCount: number;

  @Field(() => Float)
  bangerCount: number;

  @Field(() => Float)
  dislikedCount: number;

  @Field(() => Float)
  remainingCount: number;
}
