/**
 * Port for reading image file bytes (used by ServeImage use case).
 */
import { createToken } from '../../utils/create-token';

export const IMAGE_FILE_READER =
  createToken<IImageFileReader>('IMAGE_FILE_READER');

export interface IImageFileReader {
  readImage(imagePath: string, isDefault: boolean): Promise<Buffer>;
}
