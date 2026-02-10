import { ITrackIndexerPort } from '../../ports/queries/ITrackIndexerPort';

export class RecreateElasticsearchIndexUseCase {
  constructor(private readonly trackIndexerPort: ITrackIndexerPort) {}

  async execute(): Promise<void> {
    return this.trackIndexerPort.recreateIndex();
  }
}
