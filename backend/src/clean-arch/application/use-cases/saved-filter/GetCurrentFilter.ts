import { Inject, Injectable } from '@nestjs/common';
import { SavedFilter } from 'src/clean-arch/kernel/types';
import {
  ISavedFilterRepository,
  SAVED_FILTER_REPOSITORY,
} from '../../ports/repositories/ISavedFilterRepository';

@Injectable()
export class GetCurrentFilterUseCase {
  constructor(
    @Inject(SAVED_FILTER_REPOSITORY)
    private readonly savedFilterRepository: ISavedFilterRepository,
  ) {}
  async execute(): Promise<SavedFilter> {
    return this.savedFilterRepository.getCurrentFilter();
  }
}
