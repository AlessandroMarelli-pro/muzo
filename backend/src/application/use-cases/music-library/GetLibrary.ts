import { MusicLibraryId } from 'src/kernel/ids';
import { MusicLibrary } from 'src/kernel/types';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';

export class GetLibraryUseCase {
  constructor(private readonly musicLibraryRepository: IMusicLibraryRepository) {}

  async execute(id: MusicLibraryId): Promise<MusicLibrary> {
    return this.musicLibraryRepository.getOneById(id);
  }
}
