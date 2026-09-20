import type { HiddenTrack } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { apiUrl } from '@/lib/api-config';
import { capitalizeEveryWord, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Loader, Music, Pause, Play, Undo2 } from 'lucide-react';
import { memo } from 'react';

/** Mirrors FAVORITES_GRID minus the BPM/Key columns hidden tracks don't have. */
export const HIDDEN_GRID =
  'grid grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_auto] md:grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_7rem_3.5rem] items-center gap-x-3 border-l-2 border-l-transparent pl-3 pr-3';

const albumArtUrl = (imagePath?: string | null) =>
  imagePath
    ? apiUrl(`/api/images/serve-hidden?hiddenTrackId=${encodeURIComponent(imagePath)}`)
    : null;

const titleOf = (track: HiddenTrack) =>
  track.title ? capitalizeEveryWord(track.title) : 'Unknown title';
const artistOf = (track: HiddenTrack) =>
  track.artist ? capitalizeEveryWord(track.artist) : 'Unknown artist';

interface HiddenLedgerRowProps {
  track: HiddenTrack;
  selected: boolean;
  onSelectedChange: (value: boolean) => void;
  anySelected: boolean;
  onRestore: (track: HiddenTrack) => void;
  isRestoring: boolean;
  focused: boolean;
  onFocus: () => void;
  isPreviewing: boolean;
  onTogglePreview: (track: HiddenTrack) => void;
}

export const HiddenLedgerRow = memo(function HiddenLedgerRow({
  track,
  selected,
  onSelectedChange,
  anySelected,
  onRestore,
  isRestoring,
  focused,
  onFocus,
  isPreviewing,
  onTogglePreview,
}: HiddenLedgerRowProps) {
  const artUrl = albumArtUrl(track.imagePath);
  const label = `${artistOf(track)} — ${titleOf(track)}`;
  const hiddenAt = track.createdAt ? format(new Date(track.createdAt), 'MMM d, yyyy') : '—';

  return (
    <div
      role="row"
      tabIndex={-1}
      onMouseEnter={onFocus}
      data-selected={selected ? 'true' : undefined}
      className={cn(
        HIDDEN_GRID,
        'group py-2 transition-colors hover:bg-muted/50',
        selected && 'bg-primary/5',
        focused && 'bg-muted/60 ring-1 ring-inset ring-ring/40',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center transition-opacity',
          selected || anySelected || focused
            ? 'opacity-100'
            : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100',
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onSelectedChange(!!value)}
          aria-label={`Select ${titleOf(track)}`}
        />
      </div>

      {artUrl ? (
        <img
          src={artUrl}
          alt=""
          width={36}
          height={36}
          loading="lazy"
          className="size-9 rounded object-cover"
        />
      ) : (
        <div className="flex size-9 items-center justify-center rounded bg-muted" aria-hidden>
          <Music className="size-4 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-sm">{titleOf(track)}</span>
        </div>
        <p className="truncate text-muted-foreground text-xs">
          <span>{artistOf(track)}</span>
          <span className="md:hidden"> · Hidden {hiddenAt}</span>
        </p>
      </div>

      <div className="hidden whitespace-nowrap text-right font-mono text-muted-foreground text-xs tabular-nums md:block">
        {hiddenAt}
      </div>

      <div
        className={cn(
          'flex items-center justify-end gap-1 transition-opacity',
          isPreviewing
            ? 'opacity-100'
            : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100',
        )}
      >
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => onTogglePreview(track)}
          aria-label={isPreviewing ? `Pause preview of ${label}` : `Preview ${label}`}
        >
          {isPreviewing ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4 translate-x-px" aria-hidden />
          )}
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => onRestore(track)}
          disabled={isRestoring}
          aria-label={`Restore ${label}`}
        >
          {isRestoring ? (
            <Loader className="size-4 animate-spin" aria-hidden />
          ) : (
            <Undo2 className="size-4" aria-hidden />
          )}
        </Button>
      </div>
      {isPreviewing && (
        <audio
          controls
          autoPlay
          crossOrigin="use-credentials"
          src={apiUrl(`/api/audio/stream-hidden/${track.id}`)}
          onEnded={() => onTogglePreview(track)}
          className="col-span-full h-8 w-full"
        />
      )}
    </div>
  );
});
