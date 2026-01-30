import { Field, ObjectType } from '@nestjs/graphql';
import { Base64ID } from '../scalars/base64-id.scalar';

@ObjectType()
export class CleanArchPlaylist {
  @Field(() => Base64ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  isPublic: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Base64ID)
  createdById: string;

  @Field(() => Base64ID, { nullable: true })
  updatedById: string;
  /*   @Field(() => [PlaylistTrack])
  tracks: PlaylistTrack[];

  @Field(() => PlaylistSorting, { nullable: true })
  sorting?: PlaylistSorting;
 */
}
