import { createToken } from '../../utils/create-token';
import { FileInfo } from '../dtos/FileInfo';

export interface ScanOptions {
  recursive: boolean;
  includeHidden: boolean;
  maxDepth: number;
  newerThan?: Date;
}
export const FILE_MANAGER = createToken<IFileManager>('FILE_MANAGER');

export interface IFileManager {
  scanDirectory(
    rootPath: string,
    supportedFormats: string[],
    options: ScanOptions,
    currentDepth: number,
  ): Promise<FileInfo[]>;
}
