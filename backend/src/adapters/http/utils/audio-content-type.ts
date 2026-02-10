export function getContentType(fileExtension: string): string {
  const contentTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.wma': 'audio/x-ms-wma',
    '.aiff': 'audio/aiff',
    '.au': 'audio/basic',
    '.opus': 'audio/opus',
  };

  return contentTypes[fileExtension] || 'audio/mpeg';
}
