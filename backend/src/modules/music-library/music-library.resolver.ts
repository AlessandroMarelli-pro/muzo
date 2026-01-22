import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  ResolveField,
  Resolver
} from '@nestjs/graphql';
import { ScanStatus } from '@prisma/client';
import {
  CreateMusicLibraryDto,
  MusicLibraryQueryOptions,
  UpdateMusicLibraryDto,
} from '../../models/music-library.model';
import { FileScanningService } from '../../shared/services/file-scanning.service';
import {
  ProgressTrackingService
} from '../queue/progress-tracking.service';
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
export class CreateLibraryInput {
  @Field()
  name: string;

  @Field()
  rootPath: string;

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
export class LibrarySettings {
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
    private readonly fileScanningService: FileScanningService,
    private readonly queueService: QueueService,
    private readonly progressTrackingService: ProgressTrackingService,
  ) { }

  @Query(() => [MusicLibrary])
  async libraries(
    @Args('options', { nullable: true }) options?: LibraryQueryOptions,
  ): Promise<MusicLibrary[]> {
    const queryOptions: MusicLibraryQueryOptions = {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: options?.orderBy as any,
      orderDirection: options?.orderDirection as any,
    };

    return this.musicLibraryService.findAll(queryOptions);
  }

  @Query(() => MusicLibrary, { nullable: true })
  async library(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<MusicLibrary | null> {
    try {
      return await this.musicLibraryService.findOne(id);
    } catch (error) {
      return null;
    }
  }

  @Mutation(() => MusicLibrary)
  async createLibrary(
    @Args('input') input: CreateLibraryInput,
  ): Promise<MusicLibrary> {
    const createDto: CreateMusicLibraryDto = {
      name: input.name,
      rootPath: input.rootPath,
      autoScan: input.autoScan,
      scanInterval: input.scanInterval,
      includeSubdirectories: input.includeSubdirectories,
      supportedFormats: input.supportedFormats?.join(','),
      maxFileSize: input.maxFileSize,
    };

    const library = await this.musicLibraryService.create(createDto);

    // Automatically schedule a library scan if autoScan is enabled
    if (library.autoScan) {
      try {
        await this.queueService.scheduleLibraryScan(
          library.id,
          library.rootPath,
          library.name,
        );
      } catch (error) {
        // Log error but don't fail the library creation
        console.error(
          `Failed to schedule library scan for ${library.name}:`,
          error,
        );
      }
    }

    return library;
  }

  @Mutation(() => MusicLibrary)
  async updateLibrary(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateLibraryInput,
  ): Promise<MusicLibrary> {
    const updateDto: UpdateMusicLibraryDto = {
      name: input.name,
      rootPath: input.rootPath,
      autoScan: input.autoScan,
      scanInterval: input.scanInterval,
      includeSubdirectories: input.includeSubdirectories,
      supportedFormats: input.supportedFormats?.join(','),
      maxFileSize: input.maxFileSize,
    };

    return this.musicLibraryService.update(id, updateDto);
  }

  @Mutation(() => Boolean)
  async deleteLibrary(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.musicLibraryService.remove(id);
    return true;
  }

  @Mutation(() => LibraryScanResult)
  async startLibraryScan(
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

  @Mutation(() => LibraryScanResult)
  async scheduleLibraryScan(
    @Args('libraryId', { type: () => ID }) libraryId: string,
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
        scanId: `scan-${Date.now()}`,
        status: 'SCHEDULED',
        totalFiles: 0,
        processedFiles: 0,
        newTracks: 0,
        updatedTracks: 0,
        errors: 0,
        estimatedCompletion: new Date(Date.now() + 30 * 60 * 1000),
      };
    } catch (error) {
      throw new Error(`Failed to schedule library scan: ${error.message}`);
    }
  }

  @Query(() => String)
  async queueStats(): Promise<string> {
    try {
      const stats = await this.queueService.getQueueStats();
      return JSON.stringify(stats);
    } catch (error) {
      throw new Error(`Failed to get queue stats: ${error.message}`);
    }
  }

  @ResolveField(() => LibrarySettings)
  async settings(library: MusicLibrary): Promise<LibrarySettings> {
    return {
      autoScan: library.autoScan,
      scanInterval: library.scanInterval,
      includeSubdirectories: library.includeSubdirectories,
      supportedFormats: library.supportedFormats
        .split(',')
        .map((f) => f.trim()),
      maxFileSize: library.maxFileSize,
    };
  }


}
