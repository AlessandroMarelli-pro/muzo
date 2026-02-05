import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CreateLibraryInput } from 'src/clean-arch/adapters/graphql/schema/library.input';
import {
  CreateLibraryUseCase,
  DeleteLibraryUseCase,
} from 'src/clean-arch/application/use-cases';

import { parseMusicLibraryId } from '../../common/utils/parse-id';
import { toMusicLibrary } from '../mappers/music-library.mapper';
import { Base64ID } from '../scalars/base64-id.scalar';
import { Library } from '../schema/library.schema';

@Resolver(() => Library)
export class MusicLibraryResolver {
  constructor(
    private readonly createLibraryUseCase: CreateLibraryUseCase,
    private readonly deleteLibraryUseCase: DeleteLibraryUseCase,
  ) {}

  @Mutation(() => Library)
  async createLibrary(
    @Args('input') input: CreateLibraryInput,
  ): Promise<Library> {
    return this.createLibraryUseCase.execute(input).then(toMusicLibrary);
  }

  @Mutation(() => Boolean)
  async deleteLibrary(
    @Args('id', { type: () => Base64ID }) id: string,
  ): Promise<boolean> {
    return this.deleteLibraryUseCase.execute(parseMusicLibraryId(id));
  }
}
