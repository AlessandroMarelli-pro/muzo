import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Maybe } from 'src/kernel/common';
import { MusicTrackId, PlaylistId, PlaylistTrackId } from 'src/kernel/ids';
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

  @Field(() => Track, { nullable: true })
  track: Maybe<Track>;
}
