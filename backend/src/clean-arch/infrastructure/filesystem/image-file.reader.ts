import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IImageFileReader } from 'src/clean-arch/application/ports/infrastructure/IImageFileReader';

const IMAGES_DIR_KEY = 'images.dir';
const DEFAULT_IMAGES_DIR = 'images';

@Injectable()
export class FileSystemImageReader implements IImageFileReader {
  private readonly logger = new Logger(FileSystemImageReader.name);
  private readonly imagesDir: string;
  private readonly defaultImagesDir: string;

  constructor(private readonly configService: ConfigService) {
    this.imagesDir =
      this.configService.get<string>(IMAGES_DIR_KEY) ??
      path.join(process.cwd(), '..', 'muzo', DEFAULT_IMAGES_DIR);
    this.defaultImagesDir = path.join(process.cwd(), 'default-images');
  }

  async readImage(imagePath: string, isDefault: boolean): Promise<Buffer> {
    let fullPath = imagePath;
    if (!isDefault) {
      fullPath = imagePath.includes(this.imagesDir)
        ? imagePath
        : path.join(this.imagesDir, imagePath);
    }
    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      this.logger.error(`Error reading image ${imagePath}:`, error);
      throw error;
    }
  }
}
