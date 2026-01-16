import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Music2 } from 'lucide-react';
import { SpotifySync } from './third-party-apps/spotify-sync';
import { TidalSync } from './third-party-apps/tidal-sync';
import { YouTubeSync } from './third-party-apps/youtube-sync';

interface PlaylistDetailThirdPartiesProps {
  playlist: { id: string } | null;
  onSyncToYouTube: () => Promise<{
    success: boolean;
    syncedCount: number;
    skippedCount: number;
    errors: string[];
    playlistUrl?: string | null;
  }>;
  onSyncToTidal: () => Promise<{
    success: boolean;
    syncedCount: number;
    skippedCount: number;
    errors: string[];
    playlistUrl?: string | null;
  }>;
  onSyncToSpotify: () => Promise<{
    success: boolean;
    syncedCount: number;
    skippedCount: number;
    errors: string[];
    playlistUrl?: string | null;
  }>;
}

export function PlaylistDetailThirdParties({
  playlist,
  onSyncToYouTube,
  onSyncToTidal,
  onSyncToSpotify,
}: PlaylistDetailThirdPartiesProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" disabled={!playlist}>
          <Music2 className="h-4 w-4 mr-2" />
          Sync
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <YouTubeSync onSync={onSyncToYouTube} disabled={!playlist} />
        <TidalSync onSync={onSyncToTidal} disabled={!playlist} />
        <SpotifySync onSync={onSyncToSpotify} disabled={!playlist} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
