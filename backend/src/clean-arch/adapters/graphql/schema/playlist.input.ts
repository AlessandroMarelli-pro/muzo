import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CleanArchCreatePlaylistInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  isPublic?: boolean;
}

@InputType()
export class CleanArchUpdatePlaylistInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  isPublic?: boolean;
}
