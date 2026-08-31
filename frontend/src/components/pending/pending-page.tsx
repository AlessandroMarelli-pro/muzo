'use client';

import type { Track } from '@/__generated__/types';
import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton';
import { FilterButton } from '@/components/filters/filter-button';
import { PageContent, PageHeader, PageShell } from '@/components/layout/page-shell';
import { NoData } from '@/components/no-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import {
  useAudioPlayerActions,
  useCurrentTrack,
  useIsPlaying,
} from '@/contexts/audio-player-context';
import { useFilters } from '@/contexts/filter-context';
import { isTypingTarget } from '@/lib/keyboard';
import {
  useBangerTrack,
  useDislikeTrack,
  useLikeTrack,
  usePendingTracks,
} from '@/services/api-hooks';
import type { Table as TanstackTable } from '@tanstack/react-table';
import { ListMusic, Sparkles } from 'lucide-react';
import * as React from 'react';
import type { RatingKind } from './pending-columns';
import { PendingPreviewPanel } from './pending-preview-panel';
import { PendingTable } from './pending-table';

const PAGE_SIZE = 10;

export function PendingPage() {
  const [page, setPage] = React.useState(1);
  const [focusedTrackId, setFocusedTrackId] = React.useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const tableRef = React.useRef<TanstackTable<Track> | null>(null);

  const { filters, updateFilters } = useFilters();

  const { data, isLoading } = usePendingTracks({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    orderBy: 'createdAt',
    orderDirection: 'desc',
  });

  const tracks = React.useMemo(() => data?.items ?? [], [data?.items]);
  const totalPages = data?.pages ?? 0;
  const total = data?.total ?? 0;

  const likeMutation = useLikeTrack();
  const dislikeMutation = useDislikeTrack();
  const bangerMutation = useBangerTrack();
  const isRating = likeMutation.isPending || dislikeMutation.isPending || bangerMutation.isPending;

  const actions = useAudioPlayerActions();
  const { currentTrack, setCurrentTrack } = useCurrentTrack();
  const isPlaying = useIsPlaying();

  const focusedTrack = React.useMemo(
    () => tracks.find((track) => track.id === focusedTrackId),
    [tracks, focusedTrackId],
  );

  // Keep focus on a real row: when the focused track leaves the page (rated
  // away, page change, first load), take over the index it vacated.
  const previousTracksRef = React.useRef<Track[]>([]);
  React.useEffect(() => {
    if (tracks.length === 0) {
      setFocusedTrackId(null);
      previousTracksRef.current = tracks;
      return;
    }

    const stillPresent = tracks.some((track) => track.id === focusedTrackId);
    if (!stillPresent) {
      const previousIndex = previousTracksRef.current.findIndex(
        (track) => track.id === focusedTrackId,
      );
      const nextIndex = previousIndex >= 0 ? Math.min(previousIndex, tracks.length - 1) : 0;
      setFocusedTrackId(tracks[nextIndex].id);
    }

    previousTracksRef.current = tracks;
  }, [tracks, focusedTrackId]);

  const rate = React.useCallback(
    async (trackId: string, kind: RatingKind) => {
      if (kind === 'like') await likeMutation.mutateAsync(trackId);
      if (kind === 'dislike') await dislikeMutation.mutateAsync(trackId);
      if (kind === 'banger') await bangerMutation.mutateAsync(trackId);
    },
    [likeMutation, dislikeMutation, bangerMutation],
  );

  const handleRate = React.useCallback(
    (trackId: string, kind: RatingKind) => {
      void rate(trackId, kind);
    },
    [rate],
  );

  const handleBulkRate = React.useCallback(
    (trackIds: string[], kind: RatingKind) => {
      // No batch mutation exists server-side, so fan out with bounded concurrency.
      void (async () => {
        const CHUNK = 5;
        for (let index = 0; index < trackIds.length; index += CHUNK) {
          const chunk = trackIds.slice(index, index + CHUNK);
          await Promise.allSettled(chunk.map((trackId) => rate(trackId, kind)));
        }
      })();
    },
    [rate],
  );

  const handleTogglePlay = React.useCallback(
    (track: Track) => {
      if (currentTrack?.id !== track.id) {
        setCurrentTrack(track);
        actions.play(track.id);
        return;
      }
      if (isPlaying) {
        actions.pause(track.id);
      } else {
        actions.play(track.id);
      }
    },
    [actions, currentTrack, isPlaying, setCurrentTrack],
  );

  const handleFocusTrack = React.useCallback((trackId: string) => {
    setFocusedTrackId(trackId);
    // Below `lg` the panel isn't on screen, so surface it as a drawer instead.
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      setIsDrawerOpen(true);
    }
  }, []);

  const handleFilterChange = React.useCallback(
    (values: Record<string, string | string[] | null>) => {
      updateFilters(values);
    },
    [updateFilters],
  );

  const handleTableReady = React.useCallback((table: TanstackTable<Track>) => {
    tableRef.current = table;
  }, []);

  // Keyboard triage: move with arrows / j-k, rate with l-d-b, play with space.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const index = tracks.findIndex((track) => track.id === focusedTrackId);

      switch (event.key) {
        case 'ArrowDown':
        case 'j': {
          event.preventDefault();
          if (tracks.length === 0) return;
          const next = index < 0 ? 0 : Math.min(index + 1, tracks.length - 1);
          setFocusedTrackId(tracks[next].id);
          break;
        }
        case 'ArrowUp':
        case 'k': {
          event.preventDefault();
          if (tracks.length === 0) return;
          const previous = index < 0 ? 0 : Math.max(index - 1, 0);
          setFocusedTrackId(tracks[previous].id);
          break;
        }
        case ' ': {
          if (!focusedTrack) return;
          event.preventDefault();
          handleTogglePlay(focusedTrack);
          break;
        }
        case 'l':
        case 'd':
        case 'b': {
          if (!focusedTrackId || isRating) return;
          event.preventDefault();
          const kind: RatingKind =
            event.key === 'l' ? 'like' : event.key === 'd' ? 'dislike' : 'banger';
          handleRate(focusedTrackId, kind);
          break;
        }
        case 'x': {
          if (!focusedTrackId) return;
          event.preventDefault();
          tableRef.current?.getRow(focusedTrackId)?.toggleSelected();
          break;
        }
        case 'ArrowLeft': {
          event.preventDefault();
          setPage((current) => Math.max(current - 1, 1));
          break;
        }
        case 'ArrowRight': {
          event.preventDefault();
          setPage((current) => (current < totalPages ? current + 1 : current));
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tracks, focusedTrackId, focusedTrack, handleTogglePlay, handleRate, isRating, totalPages]);

  const previewPanel = (
    <PendingPreviewPanel
      track={focusedTrack}
      isRating={isRating}
      onRate={handleRate}
      onTogglePlay={handleTogglePlay}
    />
  );

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Pending" description="Tracks you haven't rated yet.">
          <FilterButton />
        </PageHeader>
        <DataTableSkeleton
          columnCount={7}
          rowCount={10}
          filterCount={0}
          withViewOptions
          withPagination
          withTopPagination={false}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Pending" description="Tracks you haven't rated yet.">
        <Badge variant="outline">{total} pending</Badge>
        <FilterButton />
      </PageHeader>

      {tracks.length === 0 ? (
        <NoData
          Icon={Sparkles}
          title="Nothing left to rate"
          subtitle="Every track matching the current filters has been rated. Adjust the filters or scan a library to find more."
          ButtonIcon={ListMusic}
        />
      ) : (
        <PageContent className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0">
            <PendingTable
              data={tracks}
              pageCount={totalPages}
              isLoading={isLoading}
              initialFilters={filters}
              onFilterChange={handleFilterChange}
              focusedTrackId={focusedTrackId}
              onFocusTrack={handleFocusTrack}
              onRate={handleRate}
              onBulkRate={handleBulkRate}
              onTogglePlay={handleTogglePlay}
              currentTrackId={currentTrack?.id}
              isPlaying={isPlaying}
              isRating={isRating}
              onTableReady={handleTableReady}
              initialPageSize={PAGE_SIZE}
            />
          </div>

          {/* Desktop: persistent side panel. Mobile: the same panel in a drawer. */}
          <div className="hidden lg:block">
            <div className="sticky top-6">{previewPanel}</div>
          </div>
        </PageContent>
      )}

      <Drawer open={isDrawerOpen && !!focusedTrack} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="lg:hidden">
          <DrawerTitle className="sr-only">Track preview</DrawerTitle>
          <div className="max-h-[80vh] overflow-y-auto p-4">{previewPanel}</div>
        </DrawerContent>
      </Drawer>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 lg:hidden">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </PageShell>
  );
}
