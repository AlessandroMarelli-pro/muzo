import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { PlaylistId } from 'src/kernel/ids';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';

export class DeletePlaylistUseCase {
  constructor(
    private readonly playlistRepository: IPlaylistRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(id: PlaylistId): Promise<boolean> {
    this.logger.info('Deleting playlist', { id });
    const result = await this.playlistRepository.deleteOneById(id);
    this.logger.info('Deleted playlist', { id, result });
    return result;
  }
}
