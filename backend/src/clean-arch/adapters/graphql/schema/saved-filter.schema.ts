import { Field, ObjectType } from '@nestjs/graphql';
import {
  GenreId,
  MusicLibraryId,
  SavedFilterId,
  SubgenreId,
} from 'src/clean-arch/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Range } from './common.schema';

@ObjectType()
export class FilterWithID<T> {
  @Field(() => Base64ID)
  id: T;

  @Field(() => String)
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
  genreIds: GenreId[];

  @Field(() => [Base64ID], { nullable: true })
  subgenreIds: SubgenreId[];

  @Field(() => [String], { nullable: true })
  keyIds: string[];

  @Field(() => [Base64ID], { nullable: true })
  libraryIds: MusicLibraryId[];

  @Field(() => [String], { nullable: true })
  atmosphereIds: string[];

  @Field(() => Range, { nullable: true })
  tempo?: { min?: number; max?: number };

  @Field(() => [String], { nullable: true })
  valenceMood?: string[];

  @Field(() => [String], { nullable: true })
  arousalMood?: string[];

  @Field(() => [String], { nullable: true })
  danceabilityFeeling?: string[];

  @Field(() => Range, { nullable: true })
  speechiness?: { min?: number; max?: number };

  @Field(() => Range, { nullable: true })
  instrumentalness?: { min?: number; max?: number };

  @Field(() => Range, { nullable: true })
  liveness?: { min?: number; max?: number };

  @Field(() => Range, { nullable: true })
  acousticness?: { min?: number; max?: number };

  @Field(() => String, { nullable: true })
  artist?: string;

  @Field(() => String, { nullable: true })
  title?: string;
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
