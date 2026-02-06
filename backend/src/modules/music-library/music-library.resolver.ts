import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Resolver,
} from '@nestjs/graphql';
import { ScanStatus } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { MusicLibraryService } from './music-library.service';

// GraphQL Object Types
@ObjectType()
export class MusicLibrary {
  @Field(() => ID)
  id: string;

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

  @Field()
  autoScan: boolean;

  @Field({ nullable: true })
  scanInterval?: number;

  @Field()
  includeSubdirectories: boolean;

  @Field()
  supportedFormats: string;

  @Field({ nullable: true })
  maxFileSize?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

// GraphQL Input Types

@InputType()
export class UpdateLibraryInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  rootPath?: string;

  @Field({ nullable: true })
  autoScan?: boolean;

  @Field(() => Int, { nullable: true })
  scanInterval?: number;

  @Field({ nullable: true })
  includeSubdirectories?: boolean;

  @Field(() => [String], { nullable: true })
  supportedFormats?: string[];

  @Field(() => Int, { nullable: true })
  maxFileSize?: number;
}

@InputType()
export class LibraryQueryOptions {
  @Field({ nullable: true })
  limit?: number;

  @Field({ nullable: true })
  offset?: number;

  @Field({ nullable: true })
  orderBy?: string;

  @Field({ nullable: true })
  orderDirection?: string;
}

// GraphQL Types
@ObjectType()
export class _LibrarySettings {
  @Field()
  autoScan: boolean;

  @Field({ nullable: true })
  scanInterval?: number;

  @Field()
  includeSubdirectories: boolean;

  @Field(() => [String])
  supportedFormats: string[];

  @Field({ nullable: true })
  maxFileSize?: number;
}

@ObjectType()
export class LibraryScanResult {
  @Field(() => ID)
  libraryId: string;

  @Field(() => ID)
  scanId: string;

  @Field()
  status: string;

  @Field()
  totalFiles: number;

  @Field()
  processedFiles: number;

  @Field()
  newTracks: number;

  @Field()
  updatedTracks: number;

  @Field()
  errors: number;

  @Field({ nullable: true })
  estimatedCompletion?: Date;
}

@Resolver(() => MusicLibrary)
export class MusicLibraryResolver {
  constructor(
    private readonly musicLibraryService: MusicLibraryService,
    private readonly queueService: QueueService,
  ) {}

  @Mutation(() => Boolean)
  async stopLibraryScan(
    @Args('libraryId', { type: () => ID }) libraryId: string,
  ): Promise<boolean> {
    await this.musicLibraryService.updateScanStatus(libraryId, ScanStatus.IDLE);
    return true;
  }
}
