import { IImageFileReader } from '../../ports/infrastructure/IImageFileReader';

export class ServeImageUseCase {
  constructor(private readonly imageFileReader: IImageFileReader) {}

  async execute(imagePath: string, isDefault: boolean): Promise<Buffer> {
    return this.imageFileReader.readImage(imagePath, isDefault);
  }
}
