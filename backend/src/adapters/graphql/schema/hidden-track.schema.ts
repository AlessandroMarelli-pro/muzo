import { Field, Float, ObjectType } from '@nestjs/graphql';
import { HiddenMusicTrackId, MusicLibraryId } from 'src/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Paginated } from './pagination.schema';

@ObjectType()
export class HiddenTrack {
  @Field(() => Base64ID)
  id: HiddenMusicTrackId;

  @Field(() => String, { nullable: true })
  artist: string;

  @Field(() => String, { nullable: true })
  title: string;

  // The hidden track's own raw UUID when it has stored art, undefined
  // otherwise -- mirrors Track.imagePath, so the client hits
  // GET /api/images/serve-hidden?hiddenTrackId=<uuid>. Not a real filesystem
  // path, matching the existing Track.imagePath convention.
  @Field(() => String, { nullable: true })
  imagePath?: string;

  @Field(() => Base64ID, { nullable: true })
  libraryId: MusicLibraryId;

  @Field(() => String)
  fileName: string;

  @Field(() => Float)
  fileSize: number;

  @Field(() => Float, { nullable: true })
  duration?: number;

  @Field(() => String, { nullable: true })
  format?: string;

  @Field({ nullable: true })
  createdAt?: Date;
}

@ObjectType()
export class PaginatedHiddenTracks extends Paginated(HiddenTrack) {}
