import { Field, InputType } from '@nestjs/graphql';
import { Maybe } from 'src/kernel/common';
import { GenreId, MusicLibraryId, SubgenreId } from 'src/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';
import { RangeInput } from './common.input';

@InputType()
export class FilterCriteriaInput {
  @Field(() => String, { nullable: true })
  artist: Maybe<string>;

  @Field(() => String, { nullable: true })
  title: Maybe<string>;

  @Field(() => [Base64ID], { nullable: true })
  genreIds: Maybe<GenreId[]>;

  @Field(() => [Base64ID], { nullable: true })
  subgenreIds: Maybe<SubgenreId[]>;

  @Field(() => [String], { nullable: true })
  atmosphereIds: Maybe<string[]>;

  @Field(() => [Base64ID], { nullable: true })
  libraryIds: Maybe<MusicLibraryId[]>;

  @Field(() => [String], { nullable: true })
  keyIds: Maybe<string[]>;

  @Field(() => RangeInput, { nullable: true })
  tempo: Maybe<{ min?: number; max?: number }>;

  @Field(() => RangeInput, { nullable: true })
  speechiness: Maybe<{ min?: number; max?: number }>;

  @Field(() => RangeInput, { nullable: true })
  instrumentalness: Maybe<{ min?: number; max?: number }>;

  @Field(() => RangeInput, { nullable: true })
  liveness: Maybe<{ min?: number; max?: number }>;

  @Field(() => RangeInput, { nullable: true })
  acousticness: Maybe<{ min?: number; max?: number }>;

  @Field(() => [String], { nullable: true })
  valenceMood: Maybe<string[]>;

  @Field(() => [String], { nullable: true })
  arousalMood: Maybe<string[]>;

  @Field(() => [String], { nullable: true })
  danceabilityFeeling: Maybe<string[]>;
}

@InputType()
export class SavedFilterInput {
  @Field(() => Boolean, { nullable: true })
  isCurrent: Maybe<boolean>;

  @Field()
  name: string;

  @Field(() => FilterCriteriaInput)
  criteria: FilterCriteriaInput;
}
