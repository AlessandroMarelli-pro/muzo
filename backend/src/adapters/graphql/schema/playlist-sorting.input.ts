import { Field, InputType } from '@nestjs/graphql';
import { PlaylistSortingDirection, PlaylistSortingKey } from 'src/kernel/types';

@InputType()
export class UpdatePlaylistSortingInput {
  @Field(() => String)
  sortingKey: PlaylistSortingKey;

  @Field(() => String)
  sortingDirection: PlaylistSortingDirection;
}
