import { Inject, Injectable } from '@nestjs/common';
import {
  ISavedFilterQuery,
  SAVED_FILTER_QUERY,
  StaticFilterOptions,
} from 'src/clean-arch/application/ports/queries/ISavedFilterQuery';

@Injectable()
export class GetStaticFilterOptionsUseCase {
  constructor(
    @Inject(SAVED_FILTER_QUERY)
    private readonly savedFilterQuery: ISavedFilterQuery,
  ) {}

  async execute(): Promise<StaticFilterOptions> {
    return this.savedFilterQuery.getStaticFilterOptions();
  }
}
