import { Track } from '@/__generated__/types';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { useFilters } from '@/contexts/filter-context';
import { usePlaybackProgress } from '@/contexts/playback-progress-context';
import { apiUrl } from '@/lib/api-config';
import {
  capitalizeEveryWord,
  cn,
  formatGenreLine,
  formatTime,
  toCamelotCode,
} from '@/lib/utils';
import { useTracks } from '@/services/api-hooks';
import {
  AudioLines,
  Check,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { FilterComponent } from '../filters/filter-component';
import { AudioQualityBadge } from '../track/audio-quality-badge';
import { Button } from '../ui/button';

interface AddTrackDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addTrackToPlaylist: (trackId: string, artist: string, title: string) => void;
  playlistId: string;
  /** Name of the set being added to — shown in the panel title. */
  playlistName?: string;
  /** Track ids already in the playlist — those rows show as "in set". */
  existingTrackIds?: string[];
}

const albumArtUrl = (imagePath?: string | null) =>
  imagePath ? apiUrl(`/api/images/serve?imagePath=${encodeURIComponent(imagePath)}`) : null;

const artistOf = (t?: Track | null) =>
  t?.artist ? capitalizeEveryWord(t.artist) : 'Unknown artist';
const titleOf = (t?: Track | null) => (t?.title ? capitalizeEveryWord(t.title) : 'Unknown title');

/**
 * The picker's column template — the playlist ledger's shape, minus the
 * position column, plus a fixed status/add lane on the right that never shifts.
 */
const PICK_GRID =
  'grid grid-cols-[2.25rem_minmax(0,1fr)_3.5rem] md:grid-cols-[2.25rem_minmax(0,1fr)_3.25rem_2.5rem_3.5rem_3.75rem] items-center gap-x-3 pl-3 pr-3';

function PickerHeader() {
  return (
    <div
      className={cn(
        PICK_GRID,
        'border-b py-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground',
      )}
    >
      <span aria-hidden />
      <span>Title / Artist</span>
      <span className="hidden text-right md:block">BPM</span>
      <span className="hidden text-right md:block">Key</span>
      <span className="hidden text-right md:block">Len</span>
      <span aria-hidden />
    </div>
  );
}

/**
 * A slim seek line for the row of the track that's currently loaded in the
 * player — a plain track filled to the play position, click or drag to scrub.
 * No waveform; it's a convenience so you needn't reach the docked bar behind
 * the panel.
 */
function RowSeekBar({ label }: { label: string }) {
  const progress = usePlaybackProgress();
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubPct, setScrubPct] = useState(0);

  const duration = progress?.duration ?? 0;
  const playedPct =
    duration > 0 ? Math.min(100, Math.max(0, ((progress?.currentTime ?? 0) / duration) * 100)) : 0;
  const pct = scrubbing ? scrubPct : playedPct;

  const pctFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  };

  const commit = (clientX: number) => {
    if (!progress || duration <= 0) return;
    progress.seek((pctFromEvent(clientX) / 100) * duration);
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={`Seek ${label}`}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round((pct / 100) * duration)}
      aria-valuetext={`${formatTime((pct / 100) * duration)} of ${formatTime(duration)}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* no real pointer (tests) — capture is optional */
        }
        setScrubbing(true);
        setScrubPct(pctFromEvent(e.clientX));
        // seek immediately on press; drag refines from here
        commit(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!scrubbing) return;
        const p = pctFromEvent(e.clientX);
        setScrubPct(p);
        commit(e.clientX);
      }}
      onPointerUp={(e) => {
        if (scrubbing) commit(e.clientX);
        setScrubbing(false);
      }}
      onClick={(e) => {
        // fallback for environments that don't deliver pointer events
        e.stopPropagation();
        commit(e.clientX);
      }}
      onKeyDown={(e) => {
        if (!progress || duration <= 0) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const step = e.key === 'ArrowRight' ? 5 : -5;
          progress.seek(Math.min(duration, Math.max(0, (progress.currentTime ?? 0) + step)));
        }
      }}
      className="group/seek absolute inset-x-0 bottom-0 flex h-3 cursor-pointer items-end px-3 focus-visible:outline-none"
    >
      <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-border">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-100 ease-linear group-focus-visible/seek:bg-primary"
          style={{ width: `${pct}%`, transitionProperty: scrubbing ? 'none' : undefined }}
        />
      </div>
      <span
        className="pointer-events-none absolute bottom-0 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover/seek:opacity-100 group-focus-visible/seek:opacity-100"
        style={{ left: `calc(${pct}% )` }}
        aria-hidden
      />
    </div>
  );
}

function PickerRow({
  track,
  inSet,
  justAdded,
  onAdd,
}: {
  track: Track;
  inSet: boolean;
  justAdded: boolean;
  onAdd: (track: Track) => void;
}) {
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const actions = useAudioPlayerActions();
  const isPlaying = useIsPlaying();

  const isCurrent = currentTrack?.id === track.id;
  const isThisPlaying = isCurrent && isPlaying;

  const artUrl = albumArtUrl(track.imagePath);
  const label = `${artistOf(track)} — ${titleOf(track)}`;
  const tempo = track.mfTempo;
  const rawKey = (track.mfCamelotKey || track.mfKey || '').trim();
  const camelot = toCamelotCode(rawKey);
  const genreLine = formatGenreLine(track.genres, track.subgenres);
  const resolved = inSet || justAdded;

  const handlePlay = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (currentTrack?.id !== track.id) {
      setCurrentTrack(track);
      actions.play(track.id);
    } else if (isThisPlaying) {
      actions.pause(track.id);
    } else {
      actions.play(track.id);
    }
  };

  return (
    <div
      data-current={isCurrent ? 'true' : undefined}
      className={cn(
        PICK_GRID,
        'group relative border-l-2 border-l-transparent py-2 transition-colors hover:bg-muted/50',
        isCurrent && 'border-l-primary bg-primary/5 pb-3.5',
        resolved && 'opacity-45',
      )}
    >
      {isCurrent && <RowSeekBar label={label} />}
      {/* Art + play-on-hover */}
      <div className="relative h-9 w-9 shrink-0">
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
        <button
          type="button"
          onClick={handlePlay}
          aria-label={isThisPlaying ? `Pause ${label}` : `Play ${label}`}
          className={cn(
            'absolute inset-0 flex items-center justify-center rounded bg-background/80 text-foreground opacity-0 backdrop-blur-[2px] transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100',
            isThisPlaying && 'opacity-100',
          )}
        >
          {isThisPlaying ? (
            <Pause className="h-4 w-4" aria-hidden />
          ) : (
            <Play className="h-4 w-4 translate-x-px" aria-hidden />
          )}
        </button>
      </div>

      {/* Title / artist / genres */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {isThisPlaying && (
            <AudioLines className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Now playing" />
          )}
          <span className="truncate text-sm font-medium">{titleOf(track)}</span>
          <AudioQualityBadge format={track.format} hqAudioPath={track.hqAudioPath} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          <span>{artistOf(track)}</span>
          {genreLine && <span className="capitalize"> · {genreLine}</span>}
          <span className="font-mono tabular-nums md:hidden">
            {' · '}
            {tempo ? Math.round(tempo) : '—'} BPM
            {camelot ? ` · ${camelot}` : ''}
          </span>
        </p>
      </div>

      {/* BPM / Key / Len */}
      <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
        {tempo ? Math.round(tempo) : '—'}
      </div>
      <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
        {camelot ?? (rawKey ? rawKey.split(' ')[0] : '—')}
      </div>
      <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:block">
        {track.duration ? formatTime(track.duration) : '—'}
      </div>

      {/* Status / add — fixed lane */}
      <div className="flex items-center justify-end">
        {resolved ? (
          <span
            className="flex items-center gap-1 whitespace-nowrap text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
            title={inSet ? 'Already in this set' : 'Just added'}
          >
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">In&nbsp;set</span>
          </span>
        ) : (
          <Button
            size="iconSm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(track);
            }}
            aria-label={`Add ${label} to the set`}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}

export function AddTrackDrawer({
  open,
  onOpenChange,
  addTrackToPlaylist,
  playlistName,
  existingTrackIds = [],
}: AddTrackDrawerProps) {
  const { ref: sentinelRef, inView } = useInView();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useTracks({
    pagination: { direction: 'AFTER', size: 50 },
  });

  const loadedTracks = useMemo(
    () => (data?.pages?.flatMap((p) => p.items) ?? []).filter((t): t is Track => Boolean(t?.id)),
    [data?.pages],
  );
  const pagesLoaded = data?.pages?.length ?? 0;

  const [query, setQuery] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const { hasActiveFilters, resetFilters } = useFilters();

  const existing = useMemo(() => new Set(existingTrackIds), [existingTrackIds]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleTracks = useMemo(() => {
    if (!normalizedQuery) return loadedTracks;
    return loadedTracks.filter((t) => {
      const hay = `${t.title ?? ''} ${t.artist ?? ''}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [loadedTracks, normalizedQuery]);

  // Keep pulling pages while the sentinel is in view. When a search is active
  // and hasn't turned up much yet, pull a few extra pages automatically so a
  // client-side match isn't hidden past the first 50 rows — but cap the
  // auto-fetch so a rare term doesn't walk the whole library. Beyond the cap
  // the "Load more" control and scrolling still work.
  const AUTO_SEARCH_PAGE_CAP = 8;
  useEffect(() => {
    if (!open || !hasNextPage || isFetchingNextPage) return;
    const searchingForMore =
      normalizedQuery.length > 0 &&
      visibleTracks.length < 25 &&
      pagesLoaded < AUTO_SEARCH_PAGE_CAP;
    if (inView || searchingForMore) {
      fetchNextPage();
    }
  }, [
    open,
    inView,
    normalizedQuery,
    visibleTracks.length,
    pagesLoaded,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  // Reset transient UI each time the panel opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setAddedIds(new Set());
      setShowRefine(false);
    }
  }, [open]);

  const handleAdd = useCallback(
    (track: Track) => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.add(track.id);
        return next;
      });
      addTrackToPlaylist(track.id, track.artist || '', track.title || '');
    },
    [addTrackToPlaylist],
  );

  const addedCount = addedIds.size;
  const title = playlistName ? `Add to “${playlistName}”` : 'Add tracks to the set';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onInteractOutside={(e) => e.preventDefault()}
        overlayClassName="!bottom-[var(--music-player-height-sm,0px)] sm:!bottom-[var(--music-player-height,0px)]"
        className={cn(
          'flex w-full flex-col gap-0 p-0 sm:max-w-[560px]',
          // stop above the docked player bar so its transport stays usable
          '!bottom-[var(--music-player-height-sm,0px)] !h-auto sm:!bottom-[var(--music-player-height,0px)]',
          showRefine && 'sm:max-w-[860px]',
        )}
      >
        {/* Masthead — the set-sheet header, echoed. The close control is the
            Sheet primitive's own (top-right); leave room for it. */}
        <header className="shrink-0 border-b px-5 pb-4 pt-5">
          <div className="min-w-0 pr-9">
            <h2 className="truncate text-base font-semibold leading-tight text-foreground">
              {title}
            </h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {addedCount > 0
                ? `${addedCount} added this session`
                : 'Search the library, add without leaving the set'}
            </p>
          </div>

          {/* Search + refine */}
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or artist…"
                aria-label="Search tracks by title or artist"
                className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-8 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-search-cancel-button]:appearance-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
            <Button
              variant={showRefine ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowRefine((v) => !v)}
              aria-pressed={showRefine}
              aria-expanded={showRefine}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Refine
              {hasActiveFilters && (
                <span
                  className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary"
                  aria-label="filters active"
                />
              )}
            </Button>
          </div>
        </header>

        {/* Body: optional refine rail + the ledger */}
        <div className="flex min-h-0 flex-1">
          {showRefine && (
            <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-r px-4 md:block">
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Refine the library
                </span>
                {hasActiveFilters && (
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={resetFilters}>
                    Clear
                  </Button>
                )}
              </div>
              <FilterComponent hideTextSearch />
            </aside>
          )}

          <div ref={scrollRef} className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            <div className="sticky top-0 z-10 bg-background">
              <PickerHeader />
            </div>

            {isLoading ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
              </div>
            ) : visibleTracks.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                  <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
                </div>
                {normalizedQuery ? (
                  <>
                    <p className="text-sm font-medium">Nothing here matches “{query}”.</p>
                    <p className="max-w-[36ch] text-xs text-muted-foreground">
                      {isFetchingNextPage ? (
                        'Scanning the library for matches…'
                      ) : hasNextPage ? (
                        <>
                          No match in the tracks loaded so far.{' '}
                          <button
                            type="button"
                            onClick={() => fetchNextPage()}
                            className="font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Keep looking
                          </button>{' '}
                          or narrow with Refine.
                        </>
                      ) : (
                        'Nothing in the library matches. Try a shorter term or use Refine.'
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">The library is empty.</p>
                )}
              </div>
            ) : (
              <div className="pb-2">
                {visibleTracks.map((track) => (
                  <PickerRow
                    key={track.id}
                    track={track}
                    inSet={existing.has(track.id)}
                    justAdded={addedIds.has(track.id)}
                    onAdd={handleAdd}
                  />
                ))}

                {/* Infinite-scroll sentinel + end-of-library marker */}
                <div ref={sentinelRef} className="flex items-center justify-center py-4">
                  {isFetchingNextPage ? (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Loading more
                    </span>
                  ) : hasNextPage ? (
                    <Button variant="ghost" size="sm" onClick={() => fetchNextPage()}>
                      Load more
                    </Button>
                  ) : (
                    <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {normalizedQuery
                        ? `${visibleTracks.length} ${visibleTracks.length === 1 ? 'match' : 'matches'}`
                        : `End of library · ${loadedTracks.length} tracks`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
