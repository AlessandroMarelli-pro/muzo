import { PlaylistTrack, Track } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { apiUrl } from '@/lib/api-config';
import {
  capitalizeEveryWord,
  cn,
  formatTime,
  isHarmonicTransition,
  toCamelotCode,
} from '@/lib/utils';
import { useAddTrackToQueue } from '@/services/queue-hooks';
import { Link } from '@tanstack/react-router';
import { AudioLines, Brain, GripVertical, ListMusic, Pause, Play, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { AudioQualityBadge } from '../track/audio-quality-badge';
import { GenresBadge } from '../track/genres-badge';
import { Skeleton } from '../ui/skeleton';

/** Album-art URL, or null when the track has no artwork (avoids a broken request). */
const albumArtUrl = (imagePath?: string | null) =>
  imagePath ? apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`) : null;

const artistOf = (track?: Track | null) =>
  track?.artist ? capitalizeEveryWord(track.artist) : 'Unknown artist';
const titleOf = (track?: Track | null) =>
  track?.title ? capitalizeEveryWord(track.title) : 'Unknown title';
const trackLabel = (track?: Track | null) => `${artistOf(track)} — ${titleOf(track)}`;

/**
 * The ledger's column template — shared by the header and every row, so they
 * stay aligned. Genres live inside the title cell (not their own column) so the
 * numeric columns never shift. Every grid gets the same 2px left border
 * (transparent unless a transition needs a mark) so the columns don't drift.
 */
export const LEDGER_GRID =
  'grid grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_auto] md:grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_3.25rem_2.5rem_3.5rem_auto] items-center gap-x-3 border-l-2 border-l-transparent pl-3 pr-3';

export function PlaylistLedgerHeader() {
  return (
    <div
      className={cn(
        LEDGER_GRID,
        'border-b bg-card py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground',
      )}
    >
      <span className="text-right">#</span>
      <span aria-hidden />
      <span>Title / Artist</span>
      <span className="hidden text-right md:block">BPM</span>
      <span className="hidden text-right md:block">Key</span>
      <span className="hidden text-right md:block">Length</span>
      <span aria-hidden />
    </div>
  );
}

export const PlaylistTrackListCardSkeleton = ({ position }: { position: number }) => {
  return (
    <div className={cn(LEDGER_GRID, 'py-2.5')}>
      <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {position}
      </span>
      <Skeleton className="h-9 w-9 rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
      <Skeleton className="hidden h-3.5 w-8 justify-self-end rounded md:block" />
      <Skeleton className="hidden h-3.5 w-8 justify-self-end rounded md:block" />
      <Skeleton className="hidden h-3.5 w-10 justify-self-end rounded md:block" />
      <span aria-hidden />
    </div>
  );
};

type TransitionKind = 'bpm' | 'key' | null;

function transitionBefore(prev?: Track | null, cur?: Track | null): TransitionKind {
  if (!prev || !cur) return null;
  if (prev.mfTempo && cur.mfTempo && Math.abs(cur.mfTempo - prev.mfTempo) >= 8) return 'bpm';
  if (!isHarmonicTransition(prev.mfCamelotKey ?? prev.mfKey, cur.mfCamelotKey ?? cur.mfKey)) {
    return 'key';
  }
  return null;
}

export const PlaylistTrackListCard = memo(
  ({
    playlistTrack,
    prevTrack,
    handleRemoveTrack,
    removingTrackId: _removingTrackId,
    dragHandleProps,
    index: _index,
    playlistLength: _playlistLength,
  }: {
    playlistTrack: PlaylistTrack;
    prevTrack?: Track | null;
    handleRemoveTrack: (trackId: string) => void;
    removingTrackId: string | null;
    dragHandleProps?: any;
    index: number;
    playlistLength: number;
  }) => {
    const { currentTrack, setCurrentTrack } = useCurrentTrack();
    const actions = useAudioPlayerActions();
    const isPlaying = useIsPlaying();
    const addToQueueMutation = useAddTrackToQueue();
    const track = playlistTrack.track ?? null;

    const isCurrentTrack = currentTrack?.id === track?.id;
    const isThisTrackPlaying = isCurrentTrack && isPlaying;

    const artUrl = albumArtUrl(track?.imagePath);
    const label = trackLabel(track);
    const tempo = track?.mfTempo;
    const rawKey = (track?.mfCamelotKey || track?.mfKey || '').trim();
    const camelot = toCamelotCode(rawKey);
    const transition = transitionBefore(prevTrack, track);

    const handlePlay = (e: React.SyntheticEvent<any>) => {
      e.stopPropagation();
      if (currentTrack?.id !== track?.id) {
        setCurrentTrack(track as Track);
        actions.play(track?.id || '');
      } else if (isThisTrackPlaying) {
        actions.pause(track?.id || '');
      } else {
        actions.play(track?.id || '');
      }
    };

    return (
      <div
        aria-current={isCurrentTrack ? 'true' : undefined}
        data-current={isCurrentTrack ? 'true' : undefined}
        title={
          transition === 'bpm'
            ? 'Big BPM jump from the previous track'
            : transition === 'key'
              ? 'Key clash with the previous track'
              : undefined
        }
        className={cn(
          LEDGER_GRID,
          'group py-2 transition-colors hover:bg-muted/50',
          // a hairline grease-pencil mark on rows whose transition needs attention
          transition && 'border-l-destructive/60',
          isCurrentTrack && 'border-l-primary bg-primary/5',
        )}
      >
        {/* # / drag handle */}
        <div className="flex items-center justify-end gap-1">
          {dragHandleProps ? (
            <button
              type="button"
              {...dragHandleProps}
              aria-label={`Reorder ${label}`}
              className="cursor-grab rounded-sm text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100 active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          <span
            className={cn(
              'font-mono text-xs tabular-nums',
              isCurrentTrack ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {playlistTrack.position}
          </span>
        </div>

        {/* Art */}
        {artUrl ? (
          <img
            src={artUrl}
            alt=""
            width={36}
            height={36}
            loading="lazy"
            className="h-9 w-9 rounded object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded bg-muted" aria-hidden>
            <ListMusic className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {/* Title / artist / genres */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {isThisTrackPlaying && (
              <AudioLines
                className="h-3.5 w-3.5 shrink-0 text-primary"
                aria-label="Now playing"
              />
            )}
            <span className="truncate text-sm font-medium">{titleOf(track)}</span>
            <AudioQualityBadge format={track?.format} hqAudioPath={track?.hqAudioPath} />
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0 truncate">{artistOf(track)}</span>
            {/* genres — inline, so they never shift the numeric columns */}
            <span className="hidden min-w-0 items-center gap-1.5 lg:flex">
              <GenresBadge genres={track?.genres || []} variant="secondary" />
              <GenresBadge genres={track?.subgenres || []} variant="outline" />
            </span>
            {/* BPM/key inline on mobile where the columns are hidden */}
            <span className="shrink-0 font-mono tabular-nums md:hidden">
              · {tempo ? `${Math.round(tempo)}` : '—'} BPM
              {camelot ? ` · ${camelot}` : ''}
            </span>
          </div>
        </div>

        {/* BPM column */}
        <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
          {tempo ? Math.round(tempo) : '—'}
        </div>
        {/* Key column */}
        <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
          {camelot ?? (rawKey ? <span title={rawKey}>{rawKey.split(' ')[0]}</span> : '—')}
        </div>
        {/* Length column */}
        <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
          {track?.duration ? formatTime(track.duration) : '—'}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-data-[current=true]:opacity-100">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={handlePlay}
            aria-label={isThisTrackPlaying ? `Pause ${label}` : `Play ${label}`}
          >
            {isThisTrackPlaying ? (
              <Pause className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4 translate-x-px" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={(e) => {
              e.stopPropagation();
              addToQueueMutation.mutate(track?.id || '');
            }}
            aria-label={`Add ${label} to queue`}
          >
            <ListMusic className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            className="text-destructive hover:text-destructive"
            onClick={() => handleRemoveTrack(track?.id || '')}
            aria-label={`Remove ${label} from playlist`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button asChild size="iconSm" variant="ghost">
            <Link
              to="/research/{-$trackId}"
              params={{ trackId: track?.id ?? '' }}
              preload="intent"
              aria-label={`Open research for ${label}`}
            >
              <Brain className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    );
  },
);
PlaylistTrackListCard.displayName = 'PlaylistTrackListCard';
