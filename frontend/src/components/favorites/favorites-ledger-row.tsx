import type { Track } from '@/__generated__/types';
import { AudioQualityBadge } from '@/components/track/audio-quality-badge';
import { TrackMoreMenu } from '@/components/track/track-more-menu';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { apiUrl } from '@/lib/api-config';
import { capitalizeEveryWord, cn, formatGenreLine, toCamelotCode } from '@/lib/utils';
import { format } from 'date-fns';
import { AudioLines, Heart, Music, Pause, Play } from 'lucide-react';
import { memo } from 'react';
import type { FavoriteTrack } from './favorites-types';

/**
 * The ledger's column template — shared by the header and every row so they
 * stay aligned. Mirrors `LEDGER_GRID` from the playlist tracks list: a fixed
 * select gutter, art, a flexible title cell, mono numeric columns, then a
 * reserved-width actions lane. Every grid carries the same 2px left border,
 * transparent unless the row is playing or a harmonic match.
 */
export const FAVORITES_GRID =
  'grid grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_auto] md:grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_3.25rem_2.75rem_5.5rem_7rem] items-center gap-x-3 border-l-2 border-l-transparent pl-3 pr-3';

const albumArtUrl = (imagePath?: string | null) =>
  imagePath ? apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`) : null;

const titleOf = (track: Track) =>
  track.title ? capitalizeEveryWord(track.title) : 'Unknown title';
const artistOf = (track: Track) =>
  track.artist ? capitalizeEveryWord(track.artist) : 'Unknown artist';

interface FavoritesLedgerRowProps {
  track: FavoriteTrack;
  selected: boolean;
  onSelectedChange: (value: boolean) => void;
  /** True once any row is selected — keeps every checkbox visible, not just on hover. */
  anySelected: boolean;
  isCurrent: boolean;
  isPlaying: boolean;
  /** Harmonic match to the track that's currently playing (and not itself). */
  harmonicMatch: boolean;
  onTogglePlay: (track: Track) => void;
  onRemove: (track: Track) => void;
  isRemoving: boolean;
  /** Keyboard-triage cursor is on this row. */
  focused: boolean;
  onFocus: () => void;
}

export const FavoritesLedgerRow = memo(function FavoritesLedgerRow({
  track,
  selected,
  onSelectedChange,
  anySelected,
  isCurrent,
  isPlaying,
  harmonicMatch,
  onTogglePlay,
  onRemove,
  isRemoving,
  focused,
  onFocus,
}: FavoritesLedgerRowProps) {
  const artUrl = albumArtUrl(track.imagePath);
  const label = `${artistOf(track)} — ${titleOf(track)}`;
  const tempo = track.mfTempo;
  const camelot = toCamelotCode(track.mfCamelotKey || track.mfKey);
  const genreLine = formatGenreLine(track.genres, track.subgenres);
  const isThisPlaying = isCurrent && isPlaying;
  const addedAt = track.addedAt ? format(new Date(track.addedAt), 'MMM d, yyyy') : '—';
  const plays = track.listeningCount ?? 0;

  return (
    <div
      role="row"
      tabIndex={-1}
      onMouseEnter={onFocus}
      aria-current={isCurrent ? 'true' : undefined}
      data-current={isCurrent ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      title={harmonicMatch ? 'Mixes with what’s playing' : undefined}
      className={cn(
        FAVORITES_GRID,
        'group py-2 transition-colors hover:bg-muted/50',
        harmonicMatch && 'border-l-primary/40',
        isCurrent && 'border-l-primary bg-primary/5',
        selected && 'bg-primary/5',
        focused && 'bg-muted/60 ring-1 ring-inset ring-ring/40',
      )}
    >
      {/* Select — hidden until row hover / focus / any selection */}
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

      {/* Art */}
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

      {/* Title / artist / genres */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {isThisPlaying && (
            <AudioLines className="size-3.5 shrink-0 text-primary" aria-label="Now playing" />
          )}
          {harmonicMatch && !isCurrent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="size-1.5 shrink-0 rounded-full bg-primary/60"
                  aria-label="Mixes with what’s playing"
                />
              </TooltipTrigger>
              <TooltipContent>Mixes with what’s playing</TooltipContent>
            </Tooltip>
          )}
          <span className="truncate font-medium text-sm">{titleOf(track)}</span>
          <AudioQualityBadge format={track.format} hqAudioPath={track.hqAudioPath} />
        </div>
        <p className="truncate text-muted-foreground text-xs">
          <span>{artistOf(track)}</span>
          {genreLine && <span className="capitalize"> · {genreLine}</span>}
          {plays > 0 && <span> · {plays.toLocaleString()} plays</span>}
          {/* BPM / key inline on mobile where the columns are hidden */}
          <span className="font-mono tabular-nums md:hidden">
            {' · '}
            {tempo ? Math.round(tempo) : '—'} BPM
            {camelot ? ` · ${camelot}` : ''}
          </span>
        </p>
      </div>

      {/* BPM */}
      <div className="hidden text-right font-mono text-muted-foreground text-xs tabular-nums md:block">
        {typeof tempo === 'number' && tempo > 0 ? Math.round(tempo) : '—'}
      </div>
      {/* Key */}
      <div className="hidden text-right font-mono text-muted-foreground text-xs tabular-nums md:block">
        {camelot ?? '—'}
      </div>
      {/* Added */}
      <div className="hidden whitespace-nowrap text-right font-mono text-muted-foreground text-xs tabular-nums md:block">
        {addedAt}
      </div>

      {/* Actions — reserved lane, revealed on hover / focus / current */}
      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-data-[current=true]:opacity-100">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => onTogglePlay(track)}
          aria-label={isThisPlaying ? `Pause ${label}` : `Play ${label}`}
        >
          {isThisPlaying ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4 translate-x-px" aria-hidden />
          )}
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => onRemove(track)}
          disabled={isRemoving}
          aria-label={`Remove ${label} from favorites`}
        >
          <Heart className="size-4 fill-red-500 text-red-500" aria-hidden />
        </Button>
        <TrackMoreMenu
          trackId={track.id}
          artist={track.artist || ''}
          title={track.title || ''}
          format={track.format}
          hqAudioPath={track.hqAudioPath}
          imagePath={track.imagePath}
        />
      </div>
    </div>
  );
});
