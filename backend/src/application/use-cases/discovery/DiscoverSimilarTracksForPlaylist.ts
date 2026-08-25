import { PlaylistId } from 'src/kernel/ids';
import type { ICosineProvider } from '../../ports/infrastructure/ICosineProvider';
import type { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
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

type ArtistSeed = { artist: string; title: string };

export class DiscoverSimilarTracksForPlaylistUseCase {
  constructor(
    private readonly getPlaylistUseCase: GetPlaylistUseCase,
    private readonly cosineProvider: ICosineProvider,
    private readonly musicTrackRepository: IMusicTrackRepository,
  ) {}

  async execute(playlistId: PlaylistId, _userId: string, limit = 30): Promise<DiscoveredTrack[]> {
    const playlist = await this.getPlaylistUseCase.execute(playlistId);
    const playlistTracks = playlist.tracks ?? [];

    const seedsByArtist = new Map<string, ArtistSeed>();
    for (const playlistTrack of playlistTracks) {
      const artist = playlistTrack.track.artist;
      const title = playlistTrack.track.title;
      if (!artist || !title) continue;
      const key = normalizeForMatch(artist);
      if (!seedsByArtist.has(key)) {
        seedsByArtist.set(key, { artist, title });
      }
    }

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
      const cosineTrack = await this.cosineProvider.searchTrack(seed.artist, seed.title);
      if (!cosineTrack) continue;

      const similarTracks = await this.cosineProvider.getSimilarTracks(cosineTrack.id);
      for (const candidate of similarTracks) {
        if (!candidate.artist || !candidate.title) continue;

        const normalizedArtist = normalizeForMatch(candidate.artist);
        const normalizedTitle = normalizeForMatch(candidate.title);
        const key = `${normalizedArtist}::${normalizedTitle}`;
        if (ownedSet.has(key)) continue;
        if (candidates.has(key)) continue;

        candidates.set(key, {
          sourceArtist: seed.artist,
          artist: candidate.artist,
          title: candidate.title,
          matchScore: candidate.score,
          externalLink: candidate.externalLink,
          videoId: candidate.videoId,
        });
      }
    }

    return Array.from(candidates.values())
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)
      .map((candidate) => ({
        sourceArtist: candidate.sourceArtist,
        artist: candidate.artist,
        title: candidate.title,
        matchScore: candidate.matchScore,
        externalLink: candidate.externalLink,
        videoId: candidate.videoId ?? null,
        confidence: candidate.videoId ? 'exact' : 'none',
      }));
  }
}
