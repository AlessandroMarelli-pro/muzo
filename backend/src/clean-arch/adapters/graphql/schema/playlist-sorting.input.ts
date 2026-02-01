import { Field, InputType } from '@nestjs/graphql';
import {
  PlaylistSortingDirection,
  PlaylistSortingKey,
} from 'src/clean-arch/kernel/types';

@InputType()
export class UpdatePlaylistSortingInput {
  @Field()
  sortingKey: PlaylistSortingKey;

  @Field()
  sortingDirection: PlaylistSortingDirection;
}
