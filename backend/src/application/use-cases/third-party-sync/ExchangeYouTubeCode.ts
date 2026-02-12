import type { IYouTubeSyncProvider } from '../../ports/infrastructure/IYouTubeSyncProvider';

export class ExchangeYouTubeCodeUseCase {
  constructor(private readonly youtubeProvider: IYouTubeSyncProvider) {}

  async execute(
    code: string,
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.youtubeProvider.exchangeCodeForTokens(code, userId);
  }
}
