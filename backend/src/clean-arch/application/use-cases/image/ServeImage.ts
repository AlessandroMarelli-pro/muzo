import { Inject, Injectable } from '@nestjs/common';
import {
  IImageFileReader,
  IMAGE_FILE_READER,
} from '../../ports/infrastructure/IImageFileReader';

@Injectable()
export class ServeImageUseCase {
  constructor(
    @Inject(IMAGE_FILE_READER)
    private readonly imageFileReader: IImageFileReader,
  ) {}

  async execute(imagePath: string, isDefault: boolean): Promise<Buffer> {
    return this.imageFileReader.readImage(imagePath, isDefault);
  }
}
