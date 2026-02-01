import { Field, InputType, Int } from '@nestjs/graphql';
import { MusicTrackId, PlaylistTrackId } from 'src/clean-arch/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';

@InputType()
export class AddTrackToPlaylistInput {
  @Field(() => Base64ID)
  trackId: MusicTrackId;

  @Field(() => Int, { nullable: true })
  position?: number;
}

@InputType()
export class UpdatePlaylistPositionInput {
  @Field(() => Base64ID)
  id: PlaylistTrackId;

  @Field(() => Int)
  position: number;
}

@InputType()
export class UpdatePlaylistPositionsInput {
  @Field(() => [UpdatePlaylistPositionInput])
  positions: UpdatePlaylistPositionInput[];
}
