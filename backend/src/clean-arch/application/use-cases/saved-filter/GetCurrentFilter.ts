import { Injectable } from '@nestjs/common';
import { SavedFilter } from 'src/clean-arch/kernel/types';
import { ISavedFilterRepository } from '../../ports/repositories/ISavedFilterRepository';

@Injectable()
export class GetCurrentFilterUseCase {
  constructor(private readonly savedFilterRepository: ISavedFilterRepository) {}
  async execute(): Promise<SavedFilter> {
    return this.savedFilterRepository.getCurrentFilter();
  }
}
