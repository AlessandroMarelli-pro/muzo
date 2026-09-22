import { Inject } from '@nestjs/common';
import {
  BANDCAMP_RESOLVE_PRODUCER,
  IBandcampResolveProducer,
} from 'src/application/ports/infrastructure/IBandcampResolveProducer';
import { PlaylistId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';

export class LookupBandcampUrlsForPlaylistUseCase {
  constructor(
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
    @Inject(BANDCAMP_RESOLVE_PRODUCER)
    private readonly bandcampResolveProducer: IBandcampResolveProducer,
  ) {}

  async execute(playlistId: PlaylistId, contextUser: ActionContext['user']): Promise<number> {
    const playlistTracks = await this.playlistTrackRepository.getTracksByPlaylistIdWithTrack(
      playlistId,
    );
    const missing = playlistTracks.filter((playlistTrack) => !playlistTrack.track.bandcampUrl);

    await Promise.all(
      missing.map((playlistTrack) =>
        this.bandcampResolveProducer.scheduleBandcampResolve(playlistTrack.track.id, contextUser),
      ),
    );

    return missing.length;
  }
}
