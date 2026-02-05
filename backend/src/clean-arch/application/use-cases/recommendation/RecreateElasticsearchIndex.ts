import { Injectable } from '@nestjs/common';
import { ITrackIndexerPort } from '../../ports/queries/ITrackIndexerPort';

@Injectable()
export class RecreateElasticsearchIndexUseCase {
  constructor(private readonly trackIndexerPort: ITrackIndexerPort) {}

  async execute(): Promise<void> {
    return this.trackIndexerPort.recreateIndex();
  }
}
