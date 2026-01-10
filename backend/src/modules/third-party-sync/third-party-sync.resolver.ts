import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  SyncResult,
  YouTubeAuthResult,
  YouTubeAuthUrl,
} from './third-party-sync.model';
import { ThirdPartySyncService } from './third-party-sync.service';

@Resolver('ThirdPartySync')
export class ThirdPartySyncResolver {
  constructor(private readonly thirdPartySyncService: ThirdPartySyncService) {}

  @Query(() => YouTubeAuthUrl)
  async getYouTubeAuthUrl(): Promise<YouTubeAuthUrl> {
    const authUrl = this.thirdPartySyncService.getYouTubeAuthUrl();
    return { authUrl };
  }

  @Mutation(() => YouTubeAuthResult)
  async authenticateYouTube(
    @Args('code') code: string,
    @Args('userId') userId: string,
  ): Promise<YouTubeAuthResult> {
    try {
      await this.thirdPartySyncService.exchangeYouTubeCode(code, userId);
      return {
        success: true,
        message: 'Successfully authenticated with YouTube',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to authenticate with YouTube',
      };
    }
  }

  @Mutation(() => SyncResult)
  async syncPlaylistToYouTube(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('userId') userId: string,
  ): Promise<SyncResult> {
    return this.thirdPartySyncService.syncPlaylistToYouTube(playlistId, userId);
  }
}
