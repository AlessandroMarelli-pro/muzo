import { Field, ObjectType } from '@nestjs/graphql';
import { PlaylistId, PlaylistSortingId } from 'src/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';

@ObjectType()
export class PlaylistSorting {
  @Field(() => Base64ID)
  id: PlaylistSortingId;

  @Field(() => Base64ID)
  playlistId: PlaylistId;

  @Field()
  sortingKey: string;

  @Field()
  sortingDirection: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date;
}
