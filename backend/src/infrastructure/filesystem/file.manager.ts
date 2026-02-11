import {
  IFileManager,
  ScanOptions,
} from 'src/application/ports/infrastructure/IFileManager';

import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileInfo } from 'src/application/ports/dtos/FileInfo';

@Injectable()
export class FileManager implements IFileManager {
  constructor() {}

  async scanDirectory(
    rootPath: string,
    supportedFormats: string[],
    options: ScanOptions,
    currentDepth: number = 0,
  ): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    if (currentDepth >= options.maxDepth) {
      return files;
    }

    try {
      const isDirectory = (await fs.stat(rootPath)).isDirectory();
      if (!isDirectory) {
        throw new Error(`Directory ${rootPath} does not exist`);
      }
      const entries = await fs.readdir(rootPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(rootPath, entry.name);

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
          const isSupported = supportedFormats
            .map((f) => f.toLowerCase())
            .includes(extension);
          if (isSupported) {
            const stats = await fs.stat(fullPath);
            // Filter by modification time if newerThan is specified
            if (options.newerThan && stats.mtime <= options.newerThan) {
              continue;
            }
            files.push({
              filePath: fullPath,
              fileName: entry.name,
              fileSize: stats.size,
              extension,
              lastModified: stats.mtime,
            });
          }
        }
      }
    } catch (error) {
      // Directory might not be readable, skip it
      console.warn(`Cannot read directory ${rootPath}:`, error);
    }

    return files;
  }
}
