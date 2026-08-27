import { Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { PlaylistId } from 'src/kernel/ids';

import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';

import type { ICopyAudioWithMetadata } from 'src/application/ports/infrastructure/ICopyAudioWithMetadata';
import type { WavMetadata } from 'src/application/ports/infrastructure/IWavConverterWithMetadata';

import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';
import { IPlaylistSortingRepository } from '../../ports/repositories/IPlaylistSortingRepository';

const EXPORT_ROOT_PATH =
  process.env.PLAYLIST_EXPORT_DIR || path.join(os.homedir(), 'Music', 'muzo-exports');

function sanitizeFileName(input: string): string {
  // Normalize to NFC so visually-identical Unicode strings produce identical filenames.
  // Also remove control chars and common invisible format characters (zero-width, bidi marks)
  // that can make downstream tools (ffmpeg/macOS) reject the output path.
  const normalized = input.normalize('NFC');

  const withoutControlsAndInvisibles = Array.from(normalized)
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;

      // Remove invisible format chars / bidi marks / soft hyphen (common in copied titles)
      if (
        cp === 0xfeff || // BOM
        cp === 0x00ad || // soft hyphen
        cp === 0x200e || // LRM
        cp === 0x200f || // RLM
        cp === 0x2060 || // word joiner
        (cp >= 0x200b && cp <= 0x200d) || // zero-width range
        (cp >= 0x202a && cp <= 0x202e) || // bidi marks
        (cp >= 0x2066 && cp <= 0x2069) // bidi isolate marks
      ) {
        return false;
      }

      // Remove ASCII control chars
      return cp >= 32 && cp !== 127;
    })
    .join('');

  const cleaned = withoutControlsAndInvisibles
    // Replace filesystem-invalid characters
    .replace(/[/\\?%*:|"<>]/g, '_')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Avoid trailing dots (can be invalid / problematic on some platforms)
    .replace(/\.+$/, '');

  return cleaned || 'unknown';
}

function normalizeMetadataValue(input: string): string {
  return input.replace(/\r?\n/g, ' ').trim();
}

function capitalizeWords(input: string): string {
  // Uppercase the first unicode letter after any non-letter boundary.
  // Leaves the rest of the string untouched to avoid unwanted case changes.
  return input.replace(/(^|[^\p{L}])(\p{L})/gu, (_match, prefix: string, letter: string) => {
    return `${prefix}${letter.toLocaleUpperCase()}`;
  });
}

export class DownloadPlaylistToFolderUseCase {
  constructor(
    private readonly playlistRepository: IPlaylistRepository,
    private readonly playlistSortingRepository: IPlaylistSortingRepository,
    private readonly copyAudioWithMetadata: ICopyAudioWithMetadata,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('DownloadPlaylistToFolderUseCase');
  }

  async execute(playlistId: PlaylistId): Promise<boolean> {
    this.logger.info('DownloadPlaylistToFolder: start', { playlistId });
    const sorting = await this.playlistSortingRepository.getByPlaylistId(playlistId);
    const playlist = await this.playlistRepository.getOneByIdWithTracks(playlistId, sorting);

    const playlistFolderName = `${sanitizeFileName(capitalizeWords(playlist.name)).replace(/ /g, '_')}`;
    const playlistFolderPath = path.join(EXPORT_ROOT_PATH, playlistFolderName);

    await fs.promises.mkdir(playlistFolderPath, { recursive: true });
    this.logger.info('DownloadPlaylistToFolder: destination prepared', {
      playlistFolderPath,
      trackCount: playlist.tracks.length,
    });

    for (const playlistTrack of playlist.tracks) {
      const track = playlistTrack.track;
      // Prefer the HQ-acquired audio file (Tidal/Soulseek FLAC/WAV) when present,
      // falling back to the originally-scanned library file otherwise.
      const hqPathExists = !!track.hqAudioPath && fs.existsSync(track.hqAudioPath);
      const sourcePath = hqPathExists ? (track.hqAudioPath as string) : track.fileInfo.filePath;
      if (!fs.existsSync(sourcePath)) {
        // If one track is missing, fail the whole operation
        this.logger.error('DownloadPlaylistToFolder: source file missing', {
          sourcePath,
          trackId: track.id,
        });
        return false;
      }

      const [artist, title] = ['artist', 'title'].map((key: 'artist' | 'title') =>
        track[key]?.trim() ? track[key] : 'Unknown',
      );
      const [displayArtist, displayTitle] = [artist, title].map(capitalizeWords);

      const [genreValue, commentValue, styleValue] = ['genres', 'subgenres', 'subgenres'].map(
        (key: 'genres' | 'subgenres') =>
          (track.metadata?.[key] &&
            normalizeMetadataValue(
              track.metadata?.[key]?.map((g) => `#${g.toLowerCase()}`).join(', '),
            )) ||
          '',
      );

      const fileBase = sanitizeFileName(`${displayArtist} - ${displayTitle}`);
      const ext = (path.extname(sourcePath) || '.opus').toLowerCase();
      const destFilePath = path.join(playlistFolderPath, `${fileBase}${ext}`);
      // Re-export behavior: overwrite existing files to refresh metadata.
      // ffmpeg will be instructed to overwrite via `-y`.
      if (fs.existsSync(destFilePath)) {
        // Remove old file first so we refresh metadata deterministically.
        this.logger.debug('DownloadPlaylistToFolder: overwriting existing file', {
          destFilePath,
        });
        await fs.promises.unlink(destFilePath).catch(() => {});
      }

      const metadata = {
        artist: normalizeMetadataValue(displayArtist),
        title: normalizeMetadataValue(displayTitle),
        genre: genreValue,
        style: styleValue,
        comment: commentValue,
      };
      this.logger.debug('DownloadPlaylistToFolder: copying track', {
        sourcePath,
        destFilePath,
        artist: displayArtist,
        title: displayTitle,
      });

      await this.copyAudioWithMetadata.copyAudioWithMetadata(
        sourcePath,
        destFilePath,
        metadata satisfies WavMetadata,
        track.imagePath,
      );

      this.logger.debug('DownloadPlaylistToFolder: copy ok', { destFilePath });
    }

    this.logger.info('DownloadPlaylistToFolder: completed', {
      playlistFolderPath,
    });
    return true;
  }
}
