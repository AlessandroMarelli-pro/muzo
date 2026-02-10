/** Result of syncing a playlist to a third-party provider (YouTube, Tidal, Spotify). */
export interface SyncResult {
  success: boolean;
  playlistId?: string;
  playlistUrl?: string;
  syncedCount: number;
  skippedCount: number;
  errors: string[];
}
