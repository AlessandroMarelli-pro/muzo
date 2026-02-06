import { createToken } from '../../utils/create-token';

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  extension: string;
  modified: Date;
}

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
