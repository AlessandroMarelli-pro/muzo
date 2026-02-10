import { Field, InputType, Int } from '@nestjs/graphql';
import { Maybe } from 'src/kernel/common';
import { GenreId, MusicLibraryId, SubgenreId } from 'src/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';
import { RangeInput } from './common.input';

@InputType()
export class PlaylistFilterInput {
  @Field(() => [Base64ID], { nullable: true })
  genreIds: Maybe<GenreId[]>;

  @Field(() => [Base64ID], { nullable: true })
  subgenreIds: Maybe<SubgenreId[]>;

  @Field(() => [String], { nullable: true })
  atmospheres: Maybe<string[]>;

  @Field(() => [Base64ID], { nullable: true })
  libraryIds: Maybe<MusicLibraryId[]>;

  @Field(() => RangeInput, { nullable: true })
  tempo: Maybe<{ min?: number; max?: number }>;
}

@InputType()
export class CreatePlaylistInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  isPublic?: boolean;
  @Field({ nullable: true })
  filters?: PlaylistFilterInput;

  @Field(() => Int, { nullable: true })
  maxTracks?: number;

  @Field({ nullable: true })
  subgenreSelectionMode?: 'exact' | 'contain';
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
