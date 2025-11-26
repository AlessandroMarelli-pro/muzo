import {
  Args,
  Field,
  ID,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { ImageSearchResult, ImageService } from './image.service';

@ObjectType()
export class ImageSearchResultType {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  trackId: string;

  @Field()
  searchUrl: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  imagePath?: string;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field({ nullable: true })
  error?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class ImageUrlResponse {
  @Field({ nullable: true })
  url?: string;
}

@ObjectType()
export class DeleteImageResponse {
  @Field()
  success: boolean;
}

@InputType()
export class SearchImageInput {
  @Field(() => ID)
  trackId: string;
}

@InputType()
export class BatchSearchInput {
  @Field(() => [ID])
  trackIds: string[];
}

@Resolver()
export class ImageResolver {
  constructor(private readonly imageService: ImageService) {}

  @Query(() => ImageSearchResultType, { nullable: true })
  async getImageForTrack(
    @Args('trackId', { type: () => ID }) trackId: string,
  ): Promise<ImageSearchResult | null> {
    return this.imageService.getImageForTrack(trackId);
  }

  @Query(() => ImageUrlResponse)
  async getImageUrl(
    @Args('trackId', { type: () => ID }) trackId: string,
  ): Promise<{ url: string | null }> {
    const url = await this.imageService.getImageUrl(trackId);
    return { url };
  }

  @Query(() => ImageSearchResultType, { nullable: true })
  async getImageSearchStatus(
    @Args('searchId', { type: () => ID }) searchId: string,
  ): Promise<ImageSearchResult | null> {
    return this.imageService.getImageSearchStatus(searchId);
  }

  @Query(() => [ImageSearchResultType])
  async getImageSearchesForTrack(
    @Args('trackId', { type: () => ID }) trackId: string,
  ): Promise<ImageSearchResult[]> {
    return this.imageService.getImageSearchesForTrack(trackId);
  }

  @Mutation(() => DeleteImageResponse)
  async deleteImageForTrack(
    @Args('trackId', { type: () => ID }) trackId: string,
  ): Promise<{ success: boolean }> {
    const success = await this.imageService.deleteImageForTrack(trackId);
    return { success };
  }
}
