import type { HiddenTrack } from '@/__generated__/types';
import { PageShell } from '@/components/layout/page-shell';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { useHiddenTracks, useRestoreHiddenTrack } from '@/services/api-hooks';
import { EyeOff } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { HiddenEmpty, HiddenNoMatches } from './hidden-empty';
import { HiddenLedger } from './hidden-ledger';
import type { HiddenSortKey, SortDirection } from './hidden-types';

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border bg-muted px-1 font-mono text-xs text-muted-foreground">
    {children}
  </kbd>
);

const matchesSearch = (track: HiddenTrack, query: string) => {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  return [track.title, track.artist].some((value) => value?.toLowerCase().includes(needle));
};

const DEFAULT_DIRECTION: Record<HiddenSortKey, SortDirection> = {
  createdAt: 'desc',
  title: 'asc',
};

const compareTracks = (
  a: HiddenTrack,
  b: HiddenTrack,
  key: HiddenSortKey,
  direction: SortDirection,
) => {
  const dir = direction === 'asc' ? 1 : -1;
  switch (key) {
    case 'title':
      return (a.title ?? '').localeCompare(b.title ?? '') * dir;
    case 'createdAt': {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (at - bt) * dir;
    }
    default:
      return 0;
  }
};

export function HiddenPage() {
  const [search, setSearch] = React.useState('');
  const [sortKey, setSortKey] = React.useState<HiddenSortKey>('createdAt');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');

  const { data, isLoading } = useHiddenTracks({ limit: 200 });
  const restoreMutation = useRestoreHiddenTrack();

  const tracks = data?.items ?? [];

  const visibleTracks = React.useMemo(() => {
    const filtered = tracks.filter((track) => matchesSearch(track, search));
    return [...filtered].sort((a, b) => compareTracks(a, b, sortKey, sortDirection));
  }, [tracks, search, sortKey, sortDirection]);

  const handleSortChange = React.useCallback((key: HiddenSortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      }
      setSortDirection(DEFAULT_DIRECTION[key]);
      return key;
    });
  }, []);

  const handleRestore = React.useCallback(
    (track: HiddenTrack) => {
      void restoreMutation.mutateAsync(track.id).then(() => {
        toast.success('Track restored', {
          description: `${track.artist || 'Unknown artist'} — ${track.title || 'Unknown title'}`,
        });
      });
    },
    [restoreMutation],
  );

  const handleBulkRestore = React.useCallback(
    (selected: HiddenTrack[]) => {
      void (async () => {
        const CHUNK = 5;
        for (let index = 0; index < selected.length; index += CHUNK) {
          const chunk = selected.slice(index, index + CHUNK);
          await Promise.allSettled(chunk.map((track) => restoreMutation.mutateAsync(track.id)));
        }
        toast.success(
          `Restored ${selected.length} ${selected.length === 1 ? 'track' : 'tracks'}`,
        );
      })();
    },
    [restoreMutation],
  );

  const hasHidden = tracks.length > 0;

  return (
    <PageShell>
      <div className="flex items-start gap-4 border-b pb-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted shadow-sm">
          <EyeOff className="size-6 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="text-2xl font-bold leading-tight">Hidden</h1>
          <p className="font-mono text-muted-foreground text-xs uppercase [letter-spacing:0.04em]">
            {tracks.length} hidden
          </p>
        </div>
      </div>

      {hasHidden && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search hidden…"
            className="sm:w-72"
          />
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !hasHidden ? (
        <HiddenEmpty />
      ) : visibleTracks.length === 0 ? (
        <HiddenNoMatches query={search} onClear={() => setSearch('')} />
      ) : (
        <HiddenLedger
          data={visibleTracks}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          onRestore={handleRestore}
          onBulkRestore={handleBulkRestore}
          isRestoring={restoreMutation.isPending}
        />
      )}
      {hasHidden && visibleTracks.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-1 text-muted-foreground text-xs">
          <Kbd>J</Kbd>
          <Kbd>K</Kbd>
          <span>move</span>
          <span className="text-border">·</span>
          <Kbd>X</Kbd>
          <span>restore</span>
        </p>
      )}
    </PageShell>
  );
}
