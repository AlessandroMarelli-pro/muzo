import { MusicLibrary } from 'src/clean-arch/kernel/types';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';

export class GetLibrariesUseCase {
  constructor(
    private readonly musicLibraryRepository: IMusicLibraryRepository,
  ) {}

  async execute(): Promise<MusicLibrary[]> {
    return this.musicLibraryRepository.getMany();
  }
}
