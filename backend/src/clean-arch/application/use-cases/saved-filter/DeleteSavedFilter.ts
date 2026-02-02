import { Inject, Injectable } from '@nestjs/common';
import { SavedFilterId } from 'src/clean-arch/kernel/ids';
import {
  ISavedFilterRepository,
  SAVED_FILTER_REPOSITORY,
} from '../../ports/repositories/ISavedFilterRepository';

@Injectable()
export class DeleteSavedFilterUseCase {
  constructor(
    @Inject(SAVED_FILTER_REPOSITORY)
    private readonly savedFilterRepository: ISavedFilterRepository,
  ) {}

  async execute(id: SavedFilterId): Promise<boolean> {
    return this.savedFilterRepository.deleteById(id);
  }
}
