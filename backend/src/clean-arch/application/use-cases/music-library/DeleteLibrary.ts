import { Injectable } from '@nestjs/common';
import { MusicLibraryId } from 'src/clean-arch/kernel/ids';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';

@Injectable()
export class DeleteLibraryUseCase {
  constructor(
    private readonly musicLibraryRepository: IMusicLibraryRepository,
  ) {}

  async execute(id: MusicLibraryId): Promise<boolean> {
    return this.musicLibraryRepository.deleteOneById(id);
  }
}
