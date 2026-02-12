import { Maybe } from 'graphql/jsutils/Maybe';
import { SavedFilter } from 'src/kernel/types';
import { ISavedFilterRepository } from '../../ports/repositories/ISavedFilterRepository';

export class GetCurrentFilterUseCase {
  constructor(private readonly savedFilterRepository: ISavedFilterRepository) {}
  async execute(): Promise<Maybe<SavedFilter>> {
    return this.savedFilterRepository.getCurrentFilter();
  }
}
