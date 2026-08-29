import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import { IImageFileReader } from 'src/application/ports/infrastructure/IImageFileReader';

/**
 * Reads image files from disk. Only used for the bundled default cover images
 * (default-images/default_{1,2,3}.jpg); the caller passes an absolute path and
 * isDefault = true. Track cover art is stored in Postgres, not on disk -- see
 * ServeTrackImageUseCase.
 */
@Injectable()
export class FileSystemImageReader implements IImageFileReader {
  private readonly logger = new Logger(FileSystemImageReader.name);

  async readImage(imagePath: string, _isDefault: boolean): Promise<Buffer> {
    try {
      return await fs.readFile(imagePath);
    } catch (error) {
      this.logger.error(`Error reading image ${imagePath}:`, error);
      throw error;
    }
  }
}
