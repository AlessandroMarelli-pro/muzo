import * as fs from 'fs';
import * as mm from 'music-metadata';
import type {
  IId3Reader,
  Id3Tags,
} from 'src/application/ports/infrastructure/IId3Reader';

export class Id3ReaderAdapter implements IId3Reader {
  async readId3Tags(filePath: string): Promise<Id3Tags> {
    try {
      if (!fs.existsSync(filePath)) {
        return {};
      }

      const metadata = await mm.parseFile(filePath, {
        duration: false,
        skipCovers: true,
      });

      const tags: Id3Tags = {
        title: this.getTagValue(metadata, ['title', 'TIT2', 'TITLE']),
        artist: this.getTagValue(metadata, ['artist', 'TPE1', 'ARTIST']),
        album: this.getTagValue(metadata, ['album', 'TALB', 'ALBUM']),
      };

      tags.purl = this.extractPurl(metadata);
      tags.url = this.extractUrl(metadata);

      return tags;
    } catch {
      return {};
    }
  }

  private extractPurl(metadata: mm.IAudioMetadata): string | null {
    const tagFields = ['purl', 'PURL', 'WXXX', 'comment', 'COMM'];
    for (const field of tagFields) {
      const value = this.getTagValue(metadata, [field]);
      if (value) {
        const url = this.extractYouTubeUrl(value);
        if (url) return url;
      }
    }
    if (metadata.native) {
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

  private extractUrl(metadata: mm.IAudioMetadata): string | null {
    const tagFields = ['url', 'URL', 'WXXX', 'comment', 'COMM'];
    for (const field of tagFields) {
      const value = this.getTagValue(metadata, [field]);
      if (value) {
        const url = this.extractTidalUrl(value);
        if (url) return url;
      }
    }
    if (metadata.native) {
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

  private extractYouTubeUrl(text: string): string | null {
    if (!text) return null;
    const youtubeRegex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/i;
    const match = text.match(youtubeRegex);
    return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
  }

  private extractTidalUrl(text: string): string | null {
    if (!text) return null;
    const tidalRegex =
      /(?:https?:\/\/)?(?:www\.)?tidal\.com\/(?:browse\/)?(?:track|album|playlist)\/(\d+)/i;
    return text.match(tidalRegex) ? text : null;
  }

  private getTagValue(
    metadata: mm.IAudioMetadata,
    fieldNames: string[],
  ): string | null {
    if (!metadata.common) return null;
    for (const fieldName of fieldNames) {
      const common = metadata.common as unknown as Record<string, unknown>;
      const value = common[fieldName.toLowerCase()];
      if (value) {
        if (Array.isArray(value)) {
          return (value[0] as string) || null;
        }
        return String(value) || null;
      }
    }
    return null;
  }
}
