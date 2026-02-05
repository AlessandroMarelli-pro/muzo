import { Injectable } from '@nestjs/common';
import { SavedFilterId } from 'src/clean-arch/kernel/ids';
import { ISavedFilterRepository } from '../../ports/repositories/ISavedFilterRepository';

@Injectable()
export class DeleteSavedFilterUseCase {
  constructor(private readonly savedFilterRepository: ISavedFilterRepository) {}

  async execute(id: SavedFilterId): Promise<boolean> {
    return this.savedFilterRepository.deleteById(id);
  }
}
