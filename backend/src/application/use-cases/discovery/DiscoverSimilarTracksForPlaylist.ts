import { Inject } from '@nestjs/common';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { MusicTrackId, PlaylistId } from 'src/kernel/ids';
import type { ICosineProvider } from '../../ports/infrastructure/ICosineProvider';
import type { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import type { IYouTubeSyncProvider } from '../../ports/infrastructure/IYouTubeSyncProvider';
import type { ICosineTrackMatchRepository } from '../../ports/repositories/ICosineTrackMatchRepository';
import type { GetPlaylistUseCase } from '../playlist/GetPlaylist';
import { normalizeForMatch } from './normalize-string';
import { forgetCosineTrackMatch, resolveCosineTrackId } from './resolve-cosine-track-id';

export type DiscoveredTrack = {
  sourceArtist: string;
  artist: string;
  title: string;
  matchScore: number;
  externalLink?: string;
  videoId: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
};

type ArtistSeed = {
  musicTrackId: MusicTrackId;
  artist: string;
  title: string;
  durationSeconds: number;
};

const SIMILAR_TRACKS_PER_SEED_LIMIT = 10;
const RESULTS_PER_PLAYLIST_TRACK = 10;

export class DiscoverSimilarTracksForPlaylistUseCase {
  constructor(
    private readonly getPlaylistUseCase: GetPlaylistUseCase,
    private readonly cosineProvider: ICosineProvider,
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly youtubeSyncProvider: IYouTubeSyncProvider,
    private readonly cosineTrackMatchRepository: ICosineTrackMatchRepository,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('DiscoverSimilarTracksForPlaylistUseCase');
  }

  private get resolveDeps() {
    return {
      cosineProvider: this.cosineProvider,
      youtubeSyncProvider: this.youtubeSyncProvider,
      cosineTrackMatchRepository: this.cosineTrackMatchRepository,
      logger: this.logger,
    };
  }

  /**
   * Resolves a seed to its cosine track id (via the mapping table / search / YouTube
   * fallback) and fetches similar tracks, dropping a stale cached id and retrying once
   * when it yields nothing.
   */
  private async getSimilarForSeed(seed: ArtistSeed, userId: string) {
    const params = {
      musicTrackId: seed.musicTrackId,
      artist: seed.artist,
      title: seed.title,
      durationSeconds: seed.durationSeconds,
      userId,
    };

    const resolved = await resolveCosineTrackId(this.resolveDeps, params);
    if (!resolved) return null;

    let similarTracks = await this.cosineProvider.getSimilarTracks(
      resolved.id,
      SIMILAR_TRACKS_PER_SEED_LIMIT,
    );

    if (similarTracks.length === 0 && resolved.fromCache) {
      await forgetCosineTrackMatch(this.resolveDeps, seed.musicTrackId);
      const reResolved = await resolveCosineTrackId(this.resolveDeps, params);
      if (!reResolved) return null;
      similarTracks = await this.cosineProvider.getSimilarTracks(
        reResolved.id,
        SIMILAR_TRACKS_PER_SEED_LIMIT,
      );
    }

    return similarTracks;
  }

  async execute(playlistId: PlaylistId, userId: string): Promise<DiscoveredTrack[]> {
    const playlist = await this.getPlaylistUseCase.execute(playlistId);
    const playlistTracks = playlist.tracks ?? [];
    const limit = playlistTracks.length * RESULTS_PER_PLAYLIST_TRACK;

    const seedsByArtist = new Map<string, ArtistSeed>();
    for (const playlistTrack of playlistTracks) {
      const artist = playlistTrack.track.artist;
      const title = playlistTrack.track.title;
      if (!artist || !title) continue;
      const key = normalizeForMatch(artist);
      if (!seedsByArtist.has(key)) {
        seedsByArtist.set(key, {
          musicTrackId: playlistTrack.track.id,
          artist,
          title,
          durationSeconds: playlistTrack.track.technicalInfo?.duration ?? 0,
        });
      }
    }

    this.logger.info('Starting playlist discovery', {
      playlistId,
      playlistTrackCount: playlistTracks.length,
      seedCount: seedsByArtist.size,
      limit,
    });

    const ownedTracks = await this.musicTrackRepository.getAll();
    const ownedSet = new Set(
      ownedTracks
        .filter((t) => t.artist && t.title)
        .map((t) => `${normalizeForMatch(t.artist)}::${normalizeForMatch(t.title)}`),
    );

    type Candidate = {
      sourceArtist: string;
      artist: string;
      title: string;
      matchScore: number;
      externalLink?: string;
      videoId?: string;
    };
    const candidates = new Map<string, Candidate>();

    for (const seed of seedsByArtist.values()) {
      this.logger.debug('Resolving Cosine track for seed', {
        artist: seed.artist,
        title: seed.title,
      });

      const similarTracks = await this.getSimilarForSeed(seed, userId);
      if (!similarTracks) {
        this.logger.info('No match found for seed track, skipping', {
          artist: seed.artist,
          title: seed.title,
        });
        continue;
      }

      this.logger.debug('Cosine returned similar tracks', {
        artist: seed.artist,
        title: seed.title,
        similarTrackCount: similarTracks.length,
      });

      let addedCount = 0;
      let ownedSkippedCount = 0;
      let duplicateSkippedCount = 0;

      for (const candidate of similarTracks) {
        if (!candidate.artist || !candidate.title) continue;

        const normalizedArtist = normalizeForMatch(candidate.artist);
        const normalizedTitle = normalizeForMatch(candidate.title);
        const key = `${normalizedArtist}::${normalizedTitle}`;
        if (ownedSet.has(key)) {
          ownedSkippedCount += 1;
          continue;
        }
        if (candidates.has(key)) {
          duplicateSkippedCount += 1;
          continue;
        }

        candidates.set(key, {
          sourceArtist: seed.artist,
          artist: candidate.artist,
          title: candidate.title,
          matchScore: candidate.score,
          externalLink: candidate.externalLink,
          videoId: candidate.videoId,
        });
        addedCount += 1;
      }

      this.logger.info('Processed seed track', {
        artist: seed.artist,
        title: seed.title,
        addedCount,
        ownedSkippedCount,
        duplicateSkippedCount,
      });
    }

    const results = Array.from(candidates.values())
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)
      .map((candidate) => ({
        sourceArtist: candidate.sourceArtist,
        artist: candidate.artist,
        title: candidate.title,
        matchScore: candidate.matchScore,
        externalLink: candidate.externalLink,
        videoId: candidate.videoId ?? null,
        confidence: (candidate.videoId ? 'exact' : 'none') as DiscoveredTrack['confidence'],
      }));

    this.logger.info('Finished playlist discovery', {
      playlistId,
      totalCandidateCount: candidates.size,
      returnedCount: results.length,
    });

    return results;
  }
}
