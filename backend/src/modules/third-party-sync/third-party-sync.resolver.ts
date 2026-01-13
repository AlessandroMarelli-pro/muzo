import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  SyncResult,
  SpotifyAuthResult,
  SpotifyAuthUrl,
  TidalAuthResult,
  TidalAuthUrl,
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

  @Query(() => TidalAuthUrl)
  getTidalAuthUrl(): TidalAuthUrl {
    const { authUrl, codeVerifier } =
      this.thirdPartySyncService.getTidalAuthUrl();
    return { authUrl, codeVerifier };
  }

  @Mutation(() => TidalAuthResult)
  async authenticateTidal(
    @Args('code') code: string,
    @Args('codeVerifier') codeVerifier: string,
    @Args('userId') userId: string,
  ): Promise<TidalAuthResult> {
    try {
      await this.thirdPartySyncService.exchangeTidalCode(
        code,
        codeVerifier,
        userId,
      );
      return {
        success: true,
        message: 'Successfully authenticated with TIDAL',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to authenticate with TIDAL',
      };
    }
  }

  @Mutation(() => SyncResult)
  async syncPlaylistToTidal(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('userId') userId: string,
  ): Promise<SyncResult> {
    return this.thirdPartySyncService.syncPlaylistToTidal(playlistId, userId);
  }

  @Query(() => SpotifyAuthUrl)
  getSpotifyAuthUrl(): SpotifyAuthUrl {
    const { authUrl, codeVerifier } =
      this.thirdPartySyncService.getSpotifyAuthUrl();
    return { authUrl, codeVerifier };
  }

  @Mutation(() => SpotifyAuthResult)
  async authenticateSpotify(
    @Args('code') code: string,
    @Args('codeVerifier') codeVerifier: string,
    @Args('userId') userId: string,
  ): Promise<SpotifyAuthResult> {
    try {
      await this.thirdPartySyncService.exchangeSpotifyCode(
        code,
        codeVerifier,
        userId,
      );
      return {
        success: true,
        message: 'Successfully authenticated with Spotify',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to authenticate with Spotify',
      };
    }
  }

  @Mutation(() => SyncResult)
  async syncPlaylistToSpotify(
    @Args('playlistId', { type: () => ID }) playlistId: string,
    @Args('userId') userId: string,
  ): Promise<SyncResult> {
    return this.thirdPartySyncService.syncPlaylistToSpotify(playlistId, userId);
  }
}
