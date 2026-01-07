import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AudioFile } from 'src/modules/queue/processors/library-scan.processor';

import { PrismaService } from './prisma.service';

export interface ScanOptions {
  recursive?: boolean;
  includeHidden?: boolean;
  maxDepth?: number;
  dryRun?: boolean;
  incremental?: boolean;
}

export interface ScanResult {
  totalFiles: number;
  newTracks: number;
  updatedTracks: number;
  skippedFiles: number;
  errors: Array<{ file: string; error: string }>;
  duration: number;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  extension: string;
  modified: Date;
}

@Injectable()
export class FileScanningService {
  constructor(private readonly prisma: PrismaService) {}

  async scanLibrary(
    libraryId: string,
    options: ScanOptions = {},
  ): Promise<AudioFile[]> {
    const startTime = Date.now();

    // Get library configuration
    const library = await this.prisma.musicLibrary.findUnique({
      where: { id: libraryId },
    });

    if (!library) {
      throw new NotFoundException(
        `Music library with ID ${libraryId} not found`,
      );
    }

    try {
      // Parse supported formats
      const supportedFormats = library.supportedFormats
        .split(',')
        .map((f) => f.trim().toLowerCase());

      // Scan directory
      // For incremental scans, only scan files modified after last scan
      const newerThan =
        options.incremental && library.lastScanAt
          ? library.lastScanAt
          : undefined;

      const files = await this.scanDirectory(
        library.rootPath,
        supportedFormats,
        {
          recursive: options.recursive ?? library.includeSubdirectories,
          includeHidden: options.includeHidden ?? false,
          maxDepth: options.maxDepth ?? 10,
          newerThan,
        },
      );
      return files.map((file) => ({
        filePath: file.path,
        libraryId,
        fileName: file.name,
        fileSize: file.size,
        lastModified: file.modified,
      }));
    } catch (error) {
      throw error;
    }
  }

  async incrementalScan(
    libraryId: string,
    options: ScanOptions = {},
  ): Promise<AudioFile[]> {
    const library = await this.prisma.musicLibrary.findUnique({
      where: { id: libraryId },
    });

    if (!library) {
      throw new NotFoundException(
        `Music library with ID ${libraryId} not found`,
      );
    }

    // Only scan files modified since last scan
    //const lastScanTime = library.lastIncrementalScanAt || library.lastScanAt;
    const lastScanTime = false;

    if (!lastScanTime) {
      // No previous scan, do full scan
      return this.scanLibrary(libraryId, options);
    }

    // Incremental scan: only processes files modified after lastScanTime
    // The newerThan parameter in scanDirectory will filter files by modification time
    return this.scanLibrary(libraryId, { ...options, incremental: true });
  }

  async validateLibraryPath(libraryId: string): Promise<boolean> {
    const library = await this.prisma.musicLibrary.findUnique({
      where: { id: libraryId },
    });

    if (!library) {
      throw new NotFoundException(
        `Music library with ID ${libraryId} not found`,
      );
    }

    try {
      const stats = fs.statSync(library.rootPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async getDirectoryInfo(directoryPath: string): Promise<{
    exists: boolean;
    isDirectory: boolean;
    readable: boolean;
    fileCount: number;
    totalSize: number;
  }> {
    try {
      const stats = fs.statSync(directoryPath);

      if (!stats.isDirectory()) {
        return {
          exists: true,
          isDirectory: false,
          readable: false,
          fileCount: 0,
          totalSize: 0,
        };
      }

      // Count files and calculate total size
      const files = await this.scanDirectory(directoryPath, [], {
        recursive: true,
        includeHidden: false,
        maxDepth: 10,
        newerThan: undefined,
      });
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      return {
        exists: true,
        isDirectory: true,
        readable: true,
        fileCount: files.length,
        totalSize,
      };
    } catch {
      return {
        exists: false,
        isDirectory: false,
        readable: false,
        fileCount: 0,
        totalSize: 0,
      };
    }
  }

  private async scanDirectory(
    directoryPath: string,
    supportedFormats: string[],
    options: {
      recursive: boolean;
      includeHidden: boolean;
      maxDepth: number;
      newerThan?: Date;
    },
    currentDepth: number = 0,
  ): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    if (currentDepth >= options.maxDepth) {
      return files;
    }

    try {
      const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);

        // Skip hidden files if not including them
        if (!options.includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        if (entry.isDirectory() && options.recursive) {
          const subFiles = await this.scanDirectory(
            fullPath,
            supportedFormats,
            options,
            currentDepth + 1,
          );
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const extension = path.extname(entry.name).toLowerCase().slice(1);

          if (supportedFormats.includes(extension)) {
            const stats = fs.statSync(fullPath);

            // Filter by modification time if newerThan is specified
            if (options.newerThan && stats.mtime <= options.newerThan) {
              continue;
            }

            files.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
              extension,
              modified: stats.mtime,
            });
          }
        }
      }
    } catch (error) {
      // Directory might not be readable, skip it
      console.warn(`Cannot read directory ${directoryPath}:`, error);
    }

    return files;
  }

  private async extractMetadata(filePath: string): Promise<{
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    year?: number;
  }> {
    // Simplified metadata extraction
    // In a real implementation, you would use a library like music-metadata
    // For now, return basic info extracted from filename

    const fileName = path.basename(filePath, path.extname(filePath));

    // Try to extract artist and title from filename (e.g., "Artist - Title.mp3")
    const parts = fileName.split(' - ');
    const artist = parts.length > 1 ? parts[0].trim() : undefined;
    const title = parts.length > 1 ? parts[1].trim() : fileName;

    return {
      title,
      artist,
      duration: 0, // Would be extracted from actual audio file
      bitrate: undefined,
      sampleRate: undefined,
      album: undefined,
      genre: undefined,
      year: undefined,
    };
  }
}
