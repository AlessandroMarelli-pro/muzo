import {
  FileInfo,
  IFileManager,
  ScanOptions,
} from 'src/clean-arch/application/ports/infrastructure/IFileManager';

import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

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

          if (supportedFormats.includes(extension)) {
            const stats = await fs.stat(fullPath);

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
      console.warn(`Cannot read directory ${rootPath}:`, error);
    }

    return files;
  }
}
