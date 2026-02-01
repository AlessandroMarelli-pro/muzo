import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
  MusicTrackId,
  PlaylistId,
  PlaylistTrackId,
} from 'src/clean-arch/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Track } from './track.schema';

@ObjectType()
export class CleanArchPlaylistTrack {
  @Field(() => Base64ID)
  id: PlaylistTrackId;

  @Field(() => Int)
  position: number;

  @Field(() => Date)
  addedAt: Date;

  @Field(() => Base64ID)
  trackId: MusicTrackId;

  @Field(() => Base64ID)
  playlistId: PlaylistId;

  @Field(() => Track)
  track: Track;
}
