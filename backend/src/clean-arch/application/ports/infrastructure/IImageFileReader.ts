/**
 * Port for reading image file bytes (used by ServeImage use case).
 */
export const IMAGE_FILE_READER = Symbol('IImageFileReader');

export interface IImageFileReader {
  readImage(imagePath: string, isDefault: boolean): Promise<Buffer>;
}
