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

  @Mutation(() => LibraryScanResult)
  async _startLibraryScan(
    @Args('libraryId', { type: () => ID }) libraryId: string,
    @Args('incremental', { nullable: true }) incremental?: boolean,
  ): Promise<LibraryScanResult> {
    try {
      // Get library information
      const library = await this.musicLibraryService.findOne(libraryId);
      if (!library) {
        throw new Error(`Library not found: ${libraryId}`);
      }

      // Schedule library scan using the queue system
      await this.queueService.scheduleLibraryScan(
        library.id,
        library.rootPath,
        library.name,
      );

      // Update library scan status
      await this.musicLibraryService.updateScanStatus(
        libraryId,
        ScanStatus.SCANNING,
      );

      return {
        libraryId,
        scanId: `scan-${Date.now()}`, // Generate a simple scan ID
        status: 'SCHEDULED',
        totalFiles: 0, // Will be updated as scan progresses
        processedFiles: 0,
        newTracks: 0,
        updatedTracks: 0,
        errors: 0,
        estimatedCompletion: new Date(Date.now() + 30 * 60 * 1000), // Estimate 30 minutes
      };
    } catch (error) {
      throw new Error(`Failed to start library scan: ${error.message}`);
    }
  }

  @Mutation(() => Boolean)
  async stopLibraryScan(
    @Args('libraryId', { type: () => ID }) libraryId: string,
  ): Promise<boolean> {
    await this.musicLibraryService.updateScanStatus(libraryId, ScanStatus.IDLE);
    return true;
  }
}
