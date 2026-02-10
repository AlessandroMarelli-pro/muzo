import type { IYouTubeSyncProvider } from '../../ports/infrastructure/IYouTubeSyncProvider';

export class GetYouTubeAuthUrlUseCase {
  constructor(private readonly youtubeProvider: IYouTubeSyncProvider) {}

  execute(): string {
    return this.youtubeProvider.getAuthUrl();
  }
}
