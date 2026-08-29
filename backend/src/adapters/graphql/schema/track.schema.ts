import { Field, Float, ObjectType } from '@nestjs/graphql';
import { AnalysisStatus } from '@prisma/client';
import { MaybeUndefined } from 'src/kernel/common';
import { MusicLibraryId, MusicTrackId } from 'src/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Node } from './common.schema';
import { CursorPaginated, Paginated } from './pagination.schema';

@ObjectType({ implements: () => [Node] })
export class Track {
  @Field(() => Base64ID)
  id: MusicTrackId;

  @Field(() => String, { nullable: true })
  artist: MaybeUndefined<string>;

  @Field(() => String, { nullable: true })
  title: MaybeUndefined<string>;

  @Field({ nullable: true })
  date?: Date;

  @Field(() => String, { nullable: true })
  format?: string;

  @Field(() => Float)
  listeningCount: number;

  @Field({ nullable: true })
  lastPlayedAt?: Date;

  @Field(() => Boolean)
  isFavorite: boolean;

  @Field(() => Boolean)
  isLiked: boolean;

  @Field(() => Boolean)
  isBanger: boolean;

  @Field(() => Float)
  duration: number;

  @Field(() => String)
  filePath: string;

  @Field(() => String, { nullable: true })
  hqAudioPath?: string;

  @Field(() => String)
  fileName: string;

  @Field()
  fileCreatedAt: Date;

  @Field(() => Float)
  fileSize: number;

  @Field(() => [String], { nullable: true })
  genres?: string[];

  @Field(() => [String], { nullable: true })
  subgenres?: string[];

  @Field(() => [String], { nullable: true })
  aiTags?: string[];

  @Field(() => String, { nullable: true })
  aiVocalsDesc?: string;

  @Field(() => String, { nullable: true })
  aiDescription?: string;

  @Field(() => String, { nullable: true })
  aiVocalsDescriptions?: string;

  @Field(() => [String], { nullable: true })
  aiAtmosphereKeywords?: string[];

  @Field(() => String, { nullable: true })
  aiContextBackgrounds?: string;

  @Field(() => String, { nullable: true })
  aiContextImpacts?: string;

  @Field(() => Float, { nullable: true })
  mfTempo?: number;

  @Field(() => String, { nullable: true })
  mfKey?: string;

  @Field(() => String, { nullable: true })
  mfCamelotKey?: string;

  @Field(() => String, { nullable: true })
  mfValenceMood?: string;

  @Field(() => String, { nullable: true })
  mfArousalMood?: string;

  @Field(() => String, { nullable: true })
  mfDanceabilityFeeling?: string;

  @Field(() => Float, { nullable: true })
  mfDanceability?: number;

  @Field(() => Float, { nullable: true })
  mfInstrumentalness?: number;

  @Field(() => Float, { nullable: true })
  mfVoice?: number;

  @Field(() => Float, { nullable: true })
  mfMoodHappy?: number;

  @Field(() => Float, { nullable: true })
  mfMoodSad?: number;

  @Field(() => Float, { nullable: true })
  mfMoodRelaxed?: number;

  @Field(() => Float, { nullable: true })
  mfMoodAggressive?: number;

  @Field(() => Float, { nullable: true })
  mfMoodParty?: number;

  @Field({ nullable: true })
  imagePath?: string;

  @Field({ nullable: true })
  lastScannedAt?: Date;

  @Field(() => Base64ID, { nullable: true })
  libraryId: MusicLibraryId;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  updatedAt?: Date;

  @Field(() => String, { nullable: true })
  analysisStatus?: AnalysisStatus;
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
