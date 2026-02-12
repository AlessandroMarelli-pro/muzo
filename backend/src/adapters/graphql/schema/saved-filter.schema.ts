import { Field, ObjectType } from '@nestjs/graphql';
import {
  GenreId,
  MusicLibraryId,
  SavedFilterId,
  SubgenreId,
} from 'src/kernel/ids';
import { Maybe } from 'src/kernel/types';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Range } from './common.schema';

@ObjectType()
export class FilterWithID<T> {
  @Field(() => Base64ID, { nullable: true })
  id: T;

  @Field(() => String, { nullable: true })
  name: string;
}

@ObjectType()
export class StaticFilterOptions {
  @Field(() => [FilterWithID<GenreId>])
  genres: FilterWithID<GenreId>[];

  @Field(() => [FilterWithID<SubgenreId>])
  subgenres: FilterWithID<SubgenreId>[];

  @Field(() => [FilterWithID<string>])
  keys: FilterWithID<string>[];

  @Field(() => [FilterWithID<MusicLibraryId>])
  libraries: FilterWithID<MusicLibraryId>[];

  @Field(() => [FilterWithID<string>])
  atmospheres: FilterWithID<string>[];
}

@ObjectType()
export class FilterCriteriaType {
  @Field(() => [Base64ID], { nullable: true })
  genreIds: Maybe<GenreId[]>;

  @Field(() => [Base64ID], { nullable: true })
  subgenreIds: Maybe<SubgenreId[]>;

  @Field(() => [String], { nullable: true })
  keyIds: Maybe<string[]>;

  @Field(() => [Base64ID], { nullable: true })
  libraryIds: Maybe<MusicLibraryId[]>;

  @Field(() => [String], { nullable: true })
  atmosphereIds: Maybe<string[]>;

  @Field(() => Range, { nullable: true })
  tempo?: Maybe<{ min?: number; max?: number }>;

  @Field(() => [String], { nullable: true })
  valenceMood?: Maybe<string[]>;

  @Field(() => [String], { nullable: true })
  arousalMood?: Maybe<string[]>;

  @Field(() => [String], { nullable: true })
  danceabilityFeeling?: Maybe<string[]>;

  @Field(() => Range, { nullable: true })
  speechiness?: Maybe<{ min?: number; max?: number }>;

  @Field(() => Range, { nullable: true })
  instrumentalness?: Maybe<{ min?: number; max?: number }>;

  @Field(() => Range, { nullable: true })
  liveness?: Maybe<{ min?: number; max?: number }>;

  @Field(() => Range, { nullable: true })
  acousticness?: Maybe<{ min?: number; max?: number }>;

  @Field(() => String, { nullable: true })
  artist?: Maybe<string>;

  @Field(() => String, { nullable: true })
  title?: Maybe<string>;
}

@ObjectType()
export class FilterCriteriaResult {
  @Field(() => FilterCriteriaType)
  criteria: FilterCriteriaType;

  @Field(() => String)
  name: string;

  @Field(() => Base64ID)
  id: SavedFilterId;
}
