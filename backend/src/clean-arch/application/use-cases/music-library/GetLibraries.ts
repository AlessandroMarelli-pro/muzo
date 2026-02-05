import { Inject, Injectable } from '@nestjs/common';
import { MusicLibrary } from 'src/clean-arch/kernel/types';
import {
  IMusicLibraryRepository,
  MUSIC_LIBRARY_REPOSITORY,
} from '../../ports/repositories/IMusicLibraryRepository';

@Injectable()
export class GetLibrariesUseCase {
  constructor(
    @Inject(MUSIC_LIBRARY_REPOSITORY)
    private readonly musicLibraryRepository: IMusicLibraryRepository,
  ) {}

  async execute(): Promise<MusicLibrary[]> {
    return this.musicLibraryRepository.getMany();
  }
}
