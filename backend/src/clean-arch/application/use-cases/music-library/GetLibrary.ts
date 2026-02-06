import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import { MusicLibrary } from 'src/clean-arch/kernel/types';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';

export class GetLibraryUseCase {
  constructor(
    private readonly musicLibraryRepository: IMusicLibraryRepository,
  ) {}

  async execute(id: MusicLibraryId): Promise<MusicLibrary> {
    return this.musicLibraryRepository.getOneById(id);
  }
}
