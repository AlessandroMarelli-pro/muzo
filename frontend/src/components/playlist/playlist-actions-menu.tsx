import { Playlist } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { PlaylistActions } from '@/services/use-playlist-actions';
import {
  Copy,
  Download,
  FileDown,
  FolderDown,
  GitMerge,
  ListMusic,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface PlaylistActionsMenuProps {
  playlist: Playlist | undefined;
  actions: PlaylistActions;
  /**
   * `card` — icon trigger, sits in the hover overlay of a grid card.
   * `detail` — small ghost trigger, sits inline in the detail-page header.
   */
  variant: 'card' | 'detail';
  /** Card grid: stop the click from bubbling to the card's own click/keydown. */
  onTriggerClick?: (e: React.MouseEvent) => void;
  triggerClassName?: string;
}

export function PlaylistActionsMenu({
  playlist,
  actions,
  variant,
  onTriggerClick,
  triggerClassName,
}: PlaylistActionsMenuProps) {
  const { pending, afterMenuCloses } = actions;
  const disabled = !playlist;
  const name = playlist?.name ?? 'this playlist';

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild className={triggerClassName}>
        <Button
          variant="ghost"
          size={variant === 'card' ? 'icon' : 'sm'}
          disabled={disabled}
          aria-label={`More actions for ${name}`}
          onClick={onTriggerClick}
        >
          <MoreHorizontal className={variant === 'card' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="z-[var(--z-player-overlay)] w-60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Playback */}
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={actions.playFromTop} disabled={disabled}>
            {actions.isPlaying ? <Pause aria-hidden /> : <Play aria-hidden />}
            {actions.isPlaying ? 'Pause' : 'Play from the top'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={afterMenuCloses(actions.requestReplaceQueue)}
            disabled={disabled || pending.replaceQueue}
          >
            <ListMusic aria-hidden />
            {pending.replaceQueue ? 'Replacing queue…' : 'Replace queue with this'}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Export */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void actions.exportM3u();
            }}
            disabled={disabled || pending.exportM3u}
          >
            <FileDown className={pending.exportM3u ? 'animate-spin' : undefined} aria-hidden />
            {pending.exportM3u ? 'Exporting…' : 'Export as .m3u'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void actions.copyFilesToFolder();
            }}
            disabled={disabled || pending.copyFilesToFolder}
          >
            <FolderDown
              className={pending.copyFilesToFolder ? 'animate-spin' : undefined}
              aria-hidden
            />
            {pending.copyFilesToFolder ? 'Copying files…' : 'Copy files to export folder'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void actions.copyTracklistCsv();
            }}
            disabled={disabled || pending.copyTracklistCsv}
          >
            <Copy aria-hidden />
            Copy tracklist (CSV)
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={afterMenuCloses(actions.openHqBatchDownload)}
            disabled={disabled}
          >
            <Download aria-hidden />
            Download all in HQ…
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Maintenance */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void actions.duplicatePlaylist();
            }}
            disabled={disabled || pending.duplicate}
          >
            <Copy aria-hidden />
            {pending.duplicate ? 'Duplicating…' : 'Duplicate playlist'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={afterMenuCloses(actions.requestMerge)} disabled={disabled}>
            <GitMerge aria-hidden />
            Merge into new playlist…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={afterMenuCloses(actions.requestRescan)}
            disabled={disabled || pending.rescan}
          >
            <RefreshCw className={pending.rescan ? 'animate-spin' : undefined} aria-hidden />
            {pending.rescan ? 'Scheduling re-scan…' : 'Force re-scan all tracks…'}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Danger */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={afterMenuCloses(actions.requestDelete)}
            disabled={disabled || pending.delete}
            className={cn('text-destructive focus:text-destructive')}
          >
            <Trash2 aria-hidden />
            Delete playlist…
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
