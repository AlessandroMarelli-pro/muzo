import type { ISpotifySyncProvider } from '../../ports/infrastructure/ISpotifySyncProvider';

export class ExchangeSpotifyCodeUseCase {
  constructor(private readonly spotifyProvider: ISpotifySyncProvider) {}

  async execute(code: string, codeVerifier: string, userId: string): Promise<void> {
    await this.spotifyProvider.exchangeCodeForTokens(code, codeVerifier, userId);
  }
}
