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
    // .opus files are an Ogg container (confirmed via magic bytes: "OggS").
    // The bare 'audio/opus' MIME type is not playable by <audio> in Chrome
    // (canPlayType returns "") — it silently refuses to even fetch the src.
    '.opus': 'audio/ogg; codecs=opus',
  };

  return contentTypes[fileExtension] || 'audio/mpeg';
}
