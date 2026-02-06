import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';

export class DeleteLibraryUseCase {
  constructor(
    private readonly musicLibraryRepository: IMusicLibraryRepository,
  ) {}

  async execute(id: MusicLibraryId): Promise<boolean> {
    return this.musicLibraryRepository.deleteOneById(id);
  }
}
