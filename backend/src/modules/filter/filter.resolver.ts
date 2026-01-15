import {
  Args,
  Field,
  Float,
  ID,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import {
  CreateFilterDto,
  FilterCriteria,
  FilterOptions as FilterOptionsModel,
  LibraryFilterOption,
  SavedFilter as SavedFilterModel,
  StaticFilterOptions as StaticFilterOptionsModel,
  UpdateFilterDto,
} from '../../models/filter.model';
import { FilterService } from './filter.service';

// GraphQL Input Types
@InputType()
export class RangeInput {
  @Field(() => Float, { nullable: true })
  min?: number;

  @Field(() => Float, { nullable: true })
  max?: number;
}

@InputType()
export class FilterCriteriaInput {
  @Field(() => String, { nullable: true })
  artist?: string;

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => [String], { nullable: true })
  genres?: string[];

  @Field(() => [String], { nullable: true })
  subgenres?: string[];

  @Field(() => [String], { nullable: true })
  keys?: string[];

  @Field(() => RangeInput, { nullable: true })
  tempo?: { min?: number; max?: number };

  @Field(() => RangeInput, { nullable: true })
  speechiness?: { min?: number; max?: number };

  @Field(() => RangeInput, { nullable: true })
  instrumentalness?: { min?: number; max?: number };

  @Field(() => RangeInput, { nullable: true })
  liveness?: { min?: number; max?: number };

  @Field(() => RangeInput, { nullable: true })
  acousticness?: { min?: number; max?: number };

  @Field(() => [String], { nullable: true })
  valenceMood?: string[];

  @Field(() => [String], { nullable: true })
  arousalMood?: string[];

  @Field(() => [String], { nullable: true })
  danceabilityFeeling?: string[];

  @Field(() => [String], { nullable: true })
  libraryId?: string[];

  @Field(() => [String], { nullable: true })
  atmospheres?: string[];
}

@InputType()
export class CreateSavedFilterInput {
  @Field()
  name: string;

  @Field(() => FilterCriteriaInput)
  criteria: FilterCriteriaInput;
}

@InputType()
export class UpdateSavedFilterInput {
  @Field({ nullable: true })
  name?: string;

  @Field(() => FilterCriteriaInput, { nullable: true })
  criteria?: FilterCriteriaInput;
}

// GraphQL Object Types
@ObjectType()
export class Range {
  @Field(() => Float)
  min: number;

  @Field(() => Float)
  max: number;
}

@ObjectType()
export class FilterCriteriaType {
  @Field(() => [String], { nullable: true })
  genres?: string[];

  @Field(() => [String], { nullable: true })
  subgenres?: string[];

  @Field(() => [String], { nullable: true })
  keys?: string[];

  @Field(() => Range, { nullable: true })
  tempo?: { min?: number; max?: number };

  @Field(() => [String], { nullable: true })
  valenceMood?: string[];

  @Field(() => [String], { nullable: true })
  arousalMood?: string[];

  @Field(() => [String], { nullable: true })
  danceabilityFeeling?: string[];

  @Field(() => Range, { nullable: true })
  speechiness?: { min?: number; max?: number };

  @Field(() => Range, { nullable: true })
  instrumentalness?: { min?: number; max?: number };

  @Field(() => Range, { nullable: true })
  liveness?: { min?: number; max?: number };

  @Field(() => Range, { nullable: true })
  acousticness?: { min?: number; max?: number };

  @Field(() => String, { nullable: true })
  artist?: string;

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => [String], { nullable: true })
  libraryId?: string[];

  @Field(() => [String], { nullable: true })
  atmospheres?: string[];
}

@ObjectType()
export class LibraryFilterOptionType {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;
}

@ObjectType()
export class StaticFilterOptions {
  @Field(() => [String])
  genres: string[];

  @Field(() => [String])
  subgenres: string[];

  @Field(() => [String])
  keys: string[];

  @Field(() => [LibraryFilterOptionType])
  libraries: LibraryFilterOption[];

  @Field(() => [String])
  atmospheres: string[];
}

@ObjectType()
export class FilterOptions {
  @Field(() => Range)
  tempoRange: { min: number; max: number };

  @Field(() => Range)
  speechinessRange: { min: number; max: number };

  @Field(() => Range)
  instrumentalnessRange: { min: number; max: number };

  @Field(() => Range)
  livenessRange: { min: number; max: number };

  @Field(() => Range)
  acousticnessRange: { min: number; max: number };
}

@ObjectType()
export class SavedFilter {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => FilterCriteriaType)
  criteria: FilterCriteria;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@Resolver()
export class FilterResolver {
  constructor(private readonly filterService: FilterService) {}

  @Query(() => StaticFilterOptions)
  async getStaticFilterOptions(): Promise<StaticFilterOptionsModel> {
    return this.filterService.getStaticFilterOptions();
  }

  @Query(() => FilterOptions)
  async getFilterOptions(): Promise<FilterOptionsModel> {
    return this.filterService.getFilterOptions();
  }

  @Query(() => FilterCriteriaType, { nullable: true })
  getCurrentFilter(): FilterCriteria | null {
    return this.filterService.getCurrentFilter();
  }

  @Mutation(() => FilterCriteriaType)
  setCurrentFilter(
    @Args('criteria') criteria: FilterCriteriaInput,
  ): FilterCriteria {
    return this.filterService.setCurrentFilter(criteria);
  }

  @Mutation(() => Boolean)
  clearCurrentFilter(): boolean {
    this.filterService.clearCurrentFilter();
    return true;
  }

  @Query(() => [SavedFilter])
  async getSavedFilters(): Promise<SavedFilterModel[]> {
    return this.filterService.findAllSavedFilters();
  }

  @Query(() => SavedFilter, { nullable: true })
  async getSavedFilter(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<SavedFilterModel | null> {
    try {
      return await this.filterService.findOneSavedFilter(id);
    } catch (error) {
      return null;
    }
  }

  @Mutation(() => SavedFilter)
  async createSavedFilter(
    @Args('input') input: CreateSavedFilterInput,
  ): Promise<SavedFilterModel> {
    const dto: CreateFilterDto = {
      name: input.name,
      criteria: input.criteria,
    };
    return this.filterService.createSavedFilter(dto);
  }

  @Mutation(() => SavedFilter)
  async updateSavedFilter(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSavedFilterInput,
  ): Promise<SavedFilterModel> {
    const dto: UpdateFilterDto = {
      name: input.name,
      criteria: input.criteria,
    };
    return this.filterService.updateSavedFilter(id, dto);
  }

  @Mutation(() => Boolean)
  async deleteSavedFilter(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.filterService.deleteSavedFilter(id);
    return true;
  }
}
