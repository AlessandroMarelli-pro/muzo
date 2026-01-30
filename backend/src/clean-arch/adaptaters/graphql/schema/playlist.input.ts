import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CleanArchCreatePlaylistInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  isPublic?: boolean;

  /*   @Field(() => PlaylistFilterInput, { nullable: true })
  filters?: PlaylistFilterInput;

  @Field(() => Int, { nullable: true })
  maxTracks?: number;

  @Field({ nullable: true })
  subgenreSelectionMode?: 'exact' | 'contain';
 */
}
