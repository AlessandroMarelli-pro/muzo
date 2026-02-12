import { Field, ObjectType } from '@nestjs/graphql';
import { MusicLibraryId } from 'src/kernel/ids';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Node } from './common.schema';

@ObjectType()
export class LibrarySettings {
  @Field()
  autoScan: boolean;

  @Field()
  includeSubdirectories: boolean;

  @Field()
  supportedFormats: string;

  @Field({ nullable: true })
  maxFileSize?: number;

  @Field({ nullable: true })
  scanInterval?: number;
}

// GraphQL Object Types
@ObjectType({ implements: () => [Node] })
export class Library {
  @Field(() => Base64ID)
  id: MusicLibraryId;

  @Field()
  name: string;

  @Field()
  rootPath: string;

  @Field()
  totalTracks: number;

  @Field()
  analyzedTracks: number;

  @Field()
  pendingTracks: number;

  @Field()
  failedTracks: number;

  @Field({ nullable: true })
  lastScanAt?: Date;

  @Field({ nullable: true })
  lastIncrementalScanAt?: Date;

  @Field()
  scanStatus: string;

  @Field(() => LibrarySettings)
  settings: LibrarySettings;

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  updatedAt?: Date;
}
