import type { TidalAuthUrlResult } from '../../ports/infrastructure/ITidalSyncProvider';
import type { ITidalSyncProvider } from '../../ports/infrastructure/ITidalSyncProvider';

export class GetTidalAuthUrlUseCase {
  constructor(private readonly tidalProvider: ITidalSyncProvider) {}

  execute(): TidalAuthUrlResult {
    return this.tidalProvider.getAuthUrl();
  }
}
