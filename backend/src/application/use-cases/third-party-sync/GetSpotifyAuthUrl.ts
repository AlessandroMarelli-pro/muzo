import type { SpotifyAuthUrlResult } from '../../ports/infrastructure/ISpotifySyncProvider';
import type { ISpotifySyncProvider } from '../../ports/infrastructure/ISpotifySyncProvider';

export class GetSpotifyAuthUrlUseCase {
  constructor(private readonly spotifyProvider: ISpotifySyncProvider) {}

  execute(): Promise<SpotifyAuthUrlResult> {
    return this.spotifyProvider.getAuthUrl();
  }
}
