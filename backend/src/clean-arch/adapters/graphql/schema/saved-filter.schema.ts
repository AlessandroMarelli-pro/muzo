import { Field, ObjectType } from '@nestjs/graphql';
import { GenreId, MusicLibraryId, SubgenreId } from 'src/clean-arch/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';

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
