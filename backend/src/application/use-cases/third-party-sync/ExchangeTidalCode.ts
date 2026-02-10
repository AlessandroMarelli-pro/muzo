import type { ITidalSyncProvider } from '../../ports/infrastructure/ITidalSyncProvider';

export class ExchangeTidalCodeUseCase {
  constructor(private readonly tidalProvider: ITidalSyncProvider) {}

  async execute(
    code: string,
    codeVerifier: string,
    userId: string,
  ): Promise<void> {
    await this.tidalProvider.exchangeCodeForTokens(
      code,
      codeVerifier,
      userId,
    );
  }
}
