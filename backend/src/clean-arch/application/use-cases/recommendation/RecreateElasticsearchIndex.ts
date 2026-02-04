import { Inject, Injectable } from '@nestjs/common';
import {
  ITrackIndexerPort,
  TRACK_INDEXER_PORT,
} from '../../ports/queries/ITrackIndexerPort';

@Injectable()
export class RecreateElasticsearchIndexUseCase {
  constructor(
    @Inject(TRACK_INDEXER_PORT)
    private readonly trackIndexerPort: ITrackIndexerPort,
  ) {}

  async execute(): Promise<void> {
    return this.trackIndexerPort.recreateIndex();
  }
}
