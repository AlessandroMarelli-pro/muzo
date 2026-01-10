import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as mm from 'music-metadata';

export interface Id3Tags {
  purl?: string | null; // YouTube URL
  url?: string | null; // Tidal URL
  title?: string;
  artist?: string;
  album?: string;
}

@Injectable()
export class Id3ReaderService {
  private readonly logger = new Logger(Id3ReaderService.name);

  /**
   * Read ID3 tags from audio file
   * Supports MP3, FLAC, Opus, M4A, and other formats
   */
  async readId3Tags(filePath: string): Promise<Id3Tags> {
    try {
      if (!fs.existsSync(filePath)) {
        this.logger.warn(`File not found: ${filePath}`);
        return {};
      }

      const metadata = await mm.parseFile(filePath, {
        duration: false, // We don't need duration here
        skipCovers: true, // Skip cover art for performance
      });

      const tags: Id3Tags = {
        title: this.getTagValue(metadata, ['title', 'TIT2', 'TITLE']),
        artist: this.getTagValue(metadata, ['artist', 'TPE1', 'ARTIST']),
        album: this.getTagValue(metadata, ['album', 'TALB', 'ALBUM']),
      };

      // Extract purl (YouTube URL) - can be in various tag fields
      tags.purl = this.extractPurl(metadata);
      tags.url = this.extractUrl(metadata);

      return tags;
    } catch (error) {
      this.logger.error(
        `Failed to read ID3 tags from ${filePath}: ${error.message}`,
      );
      return {};
    }
  }

  /**
   * Extract YouTube URL (purl) from metadata
   */
  extractPurl(metadata: mm.IAudioMetadata): string | null {
    // Check common tag fields where purl might be stored
    const tagFields = [
      'purl',
      'PURL',
      'WXXX', // User defined URL frame
      'comment', // Sometimes stored in comment
      'COMM',
    ];

    for (const field of tagFields) {
      const value = this.getTagValue(metadata, [field]);
      if (value) {
        const url = this.extractYouTubeUrl(value);
        if (url) return url;
      }
    }

    // Check native tags (format-specific)
    if (metadata.native) {
      // metadata.native is an object where keys are format names and values are arrays
      for (const formatTags of Object.values(metadata.native)) {
        if (Array.isArray(formatTags)) {
          for (const nativeTag of formatTags) {
            if (
              nativeTag.id === 'PURL' ||
              nativeTag.id === 'WXXX' ||
              nativeTag.id?.toLowerCase().includes('purl')
            ) {
              const value = Array.isArray(nativeTag.value)
                ? nativeTag.value[0]
                : nativeTag.value;
              if (typeof value === 'string') {
                const url = this.extractYouTubeUrl(value);
                if (url) return url;
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract Tidal URL from metadata
   */
  extractUrl(metadata: mm.IAudioMetadata): string | null {
    const tagFields = ['url', 'URL', 'WXXX', 'comment', 'COMM'];

    for (const field of tagFields) {
      const value = this.getTagValue(metadata, [field]);
      if (value) {
        const url = this.extractTidalUrl(value);
        if (url) return url;
      }
    }

    // Check native tags
    if (metadata.native) {
      // metadata.native is an object where keys are format names and values are arrays
      for (const formatTags of Object.values(metadata.native)) {
        if (Array.isArray(formatTags)) {
          for (const nativeTag of formatTags) {
            if (
              nativeTag.id === 'URL' ||
              nativeTag.id === 'WXXX' ||
              nativeTag.id?.toLowerCase().includes('url')
            ) {
              const value = Array.isArray(nativeTag.value)
                ? nativeTag.value[0]
                : nativeTag.value;
              if (typeof value === 'string') {
                const url = this.extractTidalUrl(value);
                if (url) return url;
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract YouTube URL from string
   */
  private extractYouTubeUrl(text: string): string | null {
    if (!text) return null;

    // Match YouTube URLs
    const youtubeRegex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/i;
    const match = text.match(youtubeRegex);
    if (match) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }

    return null;
  }

  /**
   * Extract Tidal URL from string
   */
  private extractTidalUrl(text: string): string | null {
    if (!text) return null;

    // Match Tidal URLs
    const tidalRegex =
      /(?:https?:\/\/)?(?:www\.)?tidal\.com\/(?:browse\/)?(?:track|album|playlist)\/(\d+)/i;
    const match = text.match(tidalRegex);
    if (match) {
      return text; // Return full URL
    }

    return null;
  }

  /**
   * Get tag value from metadata, checking multiple possible field names
   */
  private getTagValue(
    metadata: mm.IAudioMetadata,
    fieldNames: string[],
  ): string | null {
    if (!metadata.common) return null;

    for (const fieldName of fieldNames) {
      const value = (metadata.common as any)[fieldName.toLowerCase()];
      if (value) {
        if (Array.isArray(value)) {
          return value[0] || null;
        }
        return String(value) || null;
      }
    }

    return null;
  }
}
