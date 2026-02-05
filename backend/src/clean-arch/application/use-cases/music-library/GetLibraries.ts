import { Injectable } from '@nestjs/common';
import { MusicLibrary } from 'src/clean-arch/kernel/types';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';

@Injectable()
export class GetLibrariesUseCase {
  constructor(
    private readonly musicLibraryRepository: IMusicLibraryRepository,
  ) {}

  async execute(): Promise<MusicLibrary[]> {
    return this.musicLibraryRepository.getMany();
  }
}
