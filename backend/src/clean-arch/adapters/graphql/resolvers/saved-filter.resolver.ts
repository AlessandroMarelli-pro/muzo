import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  DeleteSavedFilterUseCase,
  UpdateSavedFilterUseCase,
} from 'src/clean-arch/application/use-cases';
import { CreateSavedFilterUseCase } from 'src/clean-arch/application/use-cases/saved-filter/CreateSavedFilter';
import { AuthGuard } from '../context/auth.guard';
import { Base64ID } from '../scalars/base64-id.scalar';
import { SavedFilterInput } from '../schema/saved-filter.input';
import { FilterCriteriaResult } from '../schema/saved-filter.schema';
import { parseSavedFilterId } from '../utils/parse-id';

@Resolver(() => FilterCriteriaResult)
@UseGuards(AuthGuard)
export class SavedFilterResolver {
  constructor(
    private readonly createSavedFilterUseCase: CreateSavedFilterUseCase,
    private readonly deleteSavedFilterUseCase: DeleteSavedFilterUseCase,
    private readonly updateSavedFilterUseCase: UpdateSavedFilterUseCase,
  ) {}
  @Mutation(() => FilterCriteriaResult)
  async createSavedFilter(
    @Args('input') input: SavedFilterInput,
  ): Promise<FilterCriteriaResult> {
    return this.createSavedFilterUseCase.execute(input);
  }

  @Mutation(() => Boolean)
  async deleteSavedFilter(
    @Args('id', { type: () => Base64ID }) id: string,
  ): Promise<boolean> {
    return this.deleteSavedFilterUseCase.execute(parseSavedFilterId(id));
  }

  @Mutation(() => FilterCriteriaResult)
  async updateSavedFilter(
    @Args('id', { type: () => Base64ID }) id: string,
    @Args('input') input: SavedFilterInput,
  ): Promise<FilterCriteriaResult> {
    return this.updateSavedFilterUseCase.execute(parseSavedFilterId(id), input);
  }
}
