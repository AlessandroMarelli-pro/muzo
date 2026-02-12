import {
  ISavedFilterQuery,
  StaticFilterOptions,
} from 'src/application/ports/queries/ISavedFilterQuery';

export class GetStaticFilterOptionsUseCase {
  constructor(private readonly savedFilterQuery: ISavedFilterQuery) {}

  async execute(): Promise<StaticFilterOptions> {
    return this.savedFilterQuery.getStaticFilterOptions();
  }
}
