import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import { MusicLibrary } from 'src/clean-arch/kernel/types';
import { createToken } from '../../utils/create-token';

export type MusicLibraryUpdateData = {
  name?: string;
  autoScan?: boolean;
  scanInterval?: number;
  includeSubdirectories?: boolean;
  supportedFormats?: string[];
  maxFileSize?: number;
};

export type MusicLibraryCreateData = {
  name: string;
  rootPath: string;
  autoScan?: boolean;
  scanInterval?: number;
  includeSubdirectories?: boolean;
  supportedFormats?: string[];
  maxFileSize?: number;
};

export const MUSIC_LIBRARY_REPOSITORY = createToken<IMusicLibraryRepository>(
  'MUSIC_LIBRARY_REPOSITORY',
);

export interface IMusicLibraryRepository {
  save(library: MusicLibraryCreateData): Promise<MusicLibrary>;
  getOneById(id: MusicLibraryId): Promise<MusicLibrary>;
  getMany(): Promise<MusicLibrary[]>;
  updateOneById(
    id: MusicLibraryId,
    data: MusicLibraryUpdateData,
  ): Promise<MusicLibrary>;
  deleteOneById(id: MusicLibraryId): Promise<boolean>;
}
