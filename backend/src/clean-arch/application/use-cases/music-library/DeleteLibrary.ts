import { Inject, Injectable } from '@nestjs/common';
import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import {
  IMusicLibraryRepository,
  MUSIC_LIBRARY_REPOSITORY,
} from '../../ports/repositories/IMusicLibraryRepository';

@Injectable()
export class DeleteLibraryUseCase {
  constructor(
    @Inject(MUSIC_LIBRARY_REPOSITORY)
    private readonly musicLibraryRepository: IMusicLibraryRepository,
  ) {}

  async execute(id: MusicLibraryId): Promise<boolean> {
    return this.musicLibraryRepository.deleteOneById(id);
  }
}
