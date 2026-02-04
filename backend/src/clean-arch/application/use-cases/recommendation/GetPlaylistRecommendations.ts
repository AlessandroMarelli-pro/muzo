import { Inject, Injectable } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import { TrackSimilarity } from 'src/clean-arch/kernel/types';
import { DEFAULT_RECOMMENDATION_WEIGHTS } from 'src/clean-arch/kernel/types/defaults';
import {
  IRecommendationDataPort,
  RECOMMENDATION_DATA_PORT,
} from '../../ports/queries/IRecommendationDataPort';
import {
  IRecommendationSearchPort,
  RECOMMENDATION_SEARCH_PORT,
} from '../../ports/queries/IRecommendationSearchPort';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';
import {
  IPlaylistTrackRepository,
  PLAYLIST_TRACK_REPOSITORY,
} from '../../ports/repositories/IPlaylistTrackRepository';

@Injectable()
export class GetPlaylistRecommendationsUseCase {
  constructor(
    @Inject(RECOMMENDATION_SEARCH_PORT)
    private readonly recommendationSearchPort: IRecommendationSearchPort,
    @Inject(PLAYLIST_TRACK_REPOSITORY)
    private readonly playlistTrackRepository: IPlaylistTrackRepository,

    @Inject(RECOMMENDATION_DATA_PORT)
    private readonly recommendationDataPort: IRecommendationDataPort,
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,
  ) {}

  async execute(
    playlistId: PlaylistId,
    limit: number = 20,
  ): Promise<TrackSimilarity[]> {
    const playlistTracks =
      await this.playlistTrackRepository.getTracksByPlaylistIdWithTrack(
        playlistId,
      );
    console.log('playlistTracks', playlistTracks.length);
    const features = this.recommendationDataPort.getAudioFeatures(
      playlistTracks.map((track) => track.track),
    );
    console.log('features', features);

    const recommendations =
      await this.recommendationSearchPort.searchByFeatures([features], {
        weights: DEFAULT_RECOMMENDATION_WEIGHTS,
        limit,
        excludeTrackIds: playlistTracks.map((track) => track.track.id),
      });
    console.log('recommendations', recommendations.length);
    const findTracks = await this.musicTrackRepository.getManyByIds(
      recommendations.map((recommendation) => recommendation.track.trackId),
    );
    console.log('findTracks', findTracks[0]);
    return recommendations.map((recommendation) => ({
      track: findTracks.find(
        (track) => track.id === recommendation.track.trackId,
      ),
      similarity: recommendation.similarity,
      reasons: recommendation.reasons,
    }));
  }
}
