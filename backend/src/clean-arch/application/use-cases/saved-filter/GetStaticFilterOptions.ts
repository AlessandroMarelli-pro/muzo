import {
  ISavedFilterQuery,
  StaticFilterOptions,
} from 'src/clean-arch/application/ports/queries/ISavedFilterQuery';

export class GetStaticFilterOptionsUseCase {
  constructor(private readonly savedFilterQuery: ISavedFilterQuery) {}

  async execute(): Promise<StaticFilterOptions> {
    return this.savedFilterQuery.getStaticFilterOptions();
  }
}
