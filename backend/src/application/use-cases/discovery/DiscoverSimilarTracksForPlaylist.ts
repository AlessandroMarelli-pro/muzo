import { Inject } from '@nestjs/common';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { PlaylistId } from 'src/kernel/ids';
import type { CosineTrack, ICosineProvider } from '../../ports/infrastructure/ICosineProvider';
import type { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import type { IYouTubeSyncProvider } from '../../ports/infrastructure/IYouTubeSyncProvider';
import type { GetPlaylistUseCase } from '../playlist/GetPlaylist';
import { normalizeForMatch } from './normalize-string';

export type DiscoveredTrack = {
  sourceArtist: string;
  artist: string;
  title: string;
  matchScore: number;
  externalLink?: string;
  videoId: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
};

type ArtistSeed = { artist: string; title: string; durationSeconds: number };

const SIMILAR_TRACKS_PER_SEED_LIMIT = 10;
const RESULTS_PER_PLAYLIST_TRACK = 10;

export class DiscoverSimilarTracksForPlaylistUseCase {
  constructor(
    private readonly getPlaylistUseCase: GetPlaylistUseCase,
    private readonly cosineProvider: ICosineProvider,
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly youtubeSyncProvider: IYouTubeSyncProvider,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('DiscoverSimilarTracksForPlaylistUseCase');
  }

  /**
   * Falls back to finding the track on YouTube and looking it up on Cosine by that
   * video URL, for cases where Cosine's own search has no strict artist/title match.
   */
  private async findViaYouTubeFallback(
    seed: ArtistSeed,
    userId: string,
  ): Promise<CosineTrack | null> {
    try {
      const match = await this.youtubeSyncProvider.findBestMatch(
        seed.artist,
        seed.title,
        seed.durationSeconds,
        userId,
      );
      if (!match.videoId) {
        this.logger.info('No YouTube match found for seed track fallback', {
          artist: seed.artist,
          title: seed.title,
        });
        return null;
      }

      this.logger.debug('Found YouTube match for seed track, looking up on Cosine', {
        artist: seed.artist,
        title: seed.title,
        videoId: match.videoId,
        confidence: match.confidence,
      });

      const cosineTrack = await this.cosineProvider.lookupTrackByUrl(
        `https://www.youtube.com/watch?v=${match.videoId}`,
      );

      if (!cosineTrack) {
        this.logger.info('YouTube video not found on Cosine', {
          artist: seed.artist,
          title: seed.title,
          videoId: match.videoId,
        });
        return null;
      }

      this.logger.info('Seed track matched via YouTube fallback', {
        artist: seed.artist,
        title: seed.title,
        videoId: match.videoId,
        cosineTrackId: cosineTrack.id,
      });

      return cosineTrack;
    } catch (error) {
      this.logger.warn('YouTube fallback lookup failed for seed track', {
        artist: seed.artist,
        title: seed.title,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
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
      this.logger.debug('Searching Cosine for seed track', {
        artist: seed.artist,
        title: seed.title,
      });

      let cosineTrack = await this.cosineProvider.searchTrack(seed.artist, seed.title);
      if (!cosineTrack) {
        this.logger.info('No strict match found for seed track, trying YouTube fallback', {
          artist: seed.artist,
          title: seed.title,
        });
        cosineTrack = await this.findViaYouTubeFallback(seed, userId);
      }
      if (!cosineTrack) {
        this.logger.info('No match found for seed track, skipping', {
          artist: seed.artist,
          title: seed.title,
        });
        continue;
      }

      this.logger.debug('Seed track matched on Cosine', {
        artist: seed.artist,
        title: seed.title,
        cosineTrackId: cosineTrack.id,
      });

      const similarTracks = await this.cosineProvider.getSimilarTracks(
        cosineTrack.id,
        SIMILAR_TRACKS_PER_SEED_LIMIT,
      );
      this.logger.debug('Cosine returned similar tracks', {
        artist: seed.artist,
        title: seed.title,
        cosineTrackId: cosineTrack.id,
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
