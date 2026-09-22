import { Inject } from '@nestjs/common';
import {
  DISCOGS_RESOLVE_PRODUCER,
  IDiscogsResolveProducer,
} from 'src/application/ports/infrastructure/IDiscogsResolveProducer';
import { PlaylistId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';

export class LookupDiscogsUrlsForPlaylistUseCase {
  constructor(
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
    @Inject(DISCOGS_RESOLVE_PRODUCER)
    private readonly discogsResolveProducer: IDiscogsResolveProducer,
  ) {}

  async execute(playlistId: PlaylistId, contextUser: ActionContext['user']): Promise<number> {
    const playlistTracks = await this.playlistTrackRepository.getTracksByPlaylistIdWithTrack(
      playlistId,
    );
    const missing = playlistTracks.filter((playlistTrack) => !playlistTrack.track.discogsUrl);

    await Promise.all(
      missing.map((playlistTrack) =>
        this.discogsResolveProducer.scheduleDiscogsResolve(playlistTrack.track.id, contextUser),
      ),
    );

    return missing.length;
  }
}
