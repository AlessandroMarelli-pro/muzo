import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ExchangeSpotifyCodeUseCase,
  ExchangeTidalCodeUseCase,
  ExchangeYouTubeCodeUseCase,
  GetSpotifyAuthUrlUseCase,
  GetTidalAuthUrlUseCase,
  GetYouTubeAuthUrlUseCase,
  SyncPlaylistToSpotifyUseCase,
  SyncPlaylistToTidalUseCase,
  SyncPlaylistToYouTubeUseCase,
} from 'src/application/use-cases/third-party-sync';
import { parsePlaylistId } from '../../common/utils/parse-id';
import { Base64ID } from '../scalars/base64-id.scalar';
import {
  SpotifyAuthResult,
  SpotifyAuthUrl,
  ThirdPartySyncResult,
  TidalAuthResult,
  TidalAuthUrl,
  YouTubeAuthResult,
  YouTubeAuthUrl,
} from '../schema/third-party-sync.schema';

@Resolver()
export class ThirdPartySyncResolver {
  constructor(
    private readonly getYouTubeAuthUrlUseCase: GetYouTubeAuthUrlUseCase,
    private readonly exchangeYouTubeCodeUseCase: ExchangeYouTubeCodeUseCase,
    private readonly syncPlaylistToYouTubeUseCase: SyncPlaylistToYouTubeUseCase,
    private readonly getTidalAuthUrlUseCase: GetTidalAuthUrlUseCase,
    private readonly exchangeTidalCodeUseCase: ExchangeTidalCodeUseCase,
    private readonly syncPlaylistToTidalUseCase: SyncPlaylistToTidalUseCase,
    private readonly getSpotifyAuthUrlUseCase: GetSpotifyAuthUrlUseCase,
    private readonly exchangeSpotifyCodeUseCase: ExchangeSpotifyCodeUseCase,
    private readonly syncPlaylistToSpotifyUseCase: SyncPlaylistToSpotifyUseCase,
  ) {}

  @Query(() => YouTubeAuthUrl)
  getYouTubeAuthUrl(): YouTubeAuthUrl {
    const authUrl = this.getYouTubeAuthUrlUseCase.execute();
    return { authUrl };
  }

  @Mutation(() => YouTubeAuthResult)
  async authenticateYouTube(
    @Args('code') code: string,
    @Args('userId') userId: string,
  ): Promise<YouTubeAuthResult> {
    try {
      await this.exchangeYouTubeCodeUseCase.execute(code, userId);
      return {
        success: true,
        message: 'Successfully authenticated with YouTube',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to authenticate with YouTube';
      return { success: false, message };
    }
  }

  @Mutation(() => ThirdPartySyncResult)
  async syncPlaylistToYouTube(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
    @Args('userId') userId: string,
  ): Promise<ThirdPartySyncResult> {
    const id = parsePlaylistId(playlistId);
    try {
      return await this.syncPlaylistToYouTubeUseCase.execute(id, userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync playlist to YouTube';
      return { success: false, syncedCount: 0, skippedCount: 0, errors: [message] };
    }
  }

  @Query(() => TidalAuthUrl)
  getTidalAuthUrl(): TidalAuthUrl {
    const { authUrl, codeVerifier } = this.getTidalAuthUrlUseCase.execute();
    return { authUrl, codeVerifier };
  }

  @Mutation(() => TidalAuthResult)
  async authenticateTidal(
    @Args('code') code: string,
    @Args('codeVerifier') codeVerifier: string,
    @Args('userId') userId: string,
  ): Promise<TidalAuthResult> {
    try {
      await this.exchangeTidalCodeUseCase.execute(code, codeVerifier, userId);
      return {
        success: true,
        message: 'Successfully authenticated with TIDAL',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to authenticate with TIDAL';
      return { success: false, message };
    }
  }

  @Mutation(() => ThirdPartySyncResult)
  async syncPlaylistToTidal(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
    @Args('userId') userId: string,
  ): Promise<ThirdPartySyncResult> {
    const id = parsePlaylistId(playlistId);
    try {
      return await this.syncPlaylistToTidalUseCase.execute(id, userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync playlist to TIDAL';
      return { success: false, syncedCount: 0, skippedCount: 0, errors: [message] };
    }
  }

  @Query(() => SpotifyAuthUrl)
  getSpotifyAuthUrl(): SpotifyAuthUrl {
    const { authUrl, codeVerifier } = this.getSpotifyAuthUrlUseCase.execute();
    return { authUrl, codeVerifier };
  }

  @Mutation(() => SpotifyAuthResult)
  async authenticateSpotify(
    @Args('code') code: string,
    @Args('codeVerifier') codeVerifier: string,
    @Args('userId') userId: string,
  ): Promise<SpotifyAuthResult> {
    try {
      await this.exchangeSpotifyCodeUseCase.execute(code, codeVerifier, userId);
      return {
        success: true,
        message: 'Successfully authenticated with Spotify',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to authenticate with Spotify';
      return { success: false, message };
    }
  }

  @Mutation(() => ThirdPartySyncResult)
  async syncPlaylistToSpotify(
    @Args('playlistId', { type: () => Base64ID }) playlistId: string,
    @Args('userId') userId: string,
  ): Promise<ThirdPartySyncResult> {
    const id = parsePlaylistId(playlistId);
    try {
      return await this.syncPlaylistToSpotifyUseCase.execute(id, userId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to sync playlist to Spotify';
      return { success: false, syncedCount: 0, skippedCount: 0, errors: [message] };
    }
  }
}
