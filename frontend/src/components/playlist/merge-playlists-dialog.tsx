import { Playlist } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiUrl } from '@/lib/api-config';
import { cn } from '@/lib/utils';
import { useMergePlaylists, usePlaylists } from '@/services/playlist-hooks';
import { useRouter } from '@tanstack/react-router';
import { ArrowLeft, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface MergePlaylistsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlist: Playlist | undefined;
}

/** 2×2 cover mosaic — mirrors the crate-strip pattern used in the "add to playlist" picker. */
function CrateCover({ images, name }: { images: string[]; name: string }) {
  const covers = images.slice(0, 4);

  if (covers.length === 0) {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
        {name.trim().charAt(0).toUpperCase() || '#'}
      </div>
    );
  }

  if (covers.length < 4) {
    return (
      <img
        src={apiUrl(`/api/images/serve?imagePath=${covers[0]}`)}
        alt=""
        className="size-12 shrink-0 rounded-md object-cover"
      />
    );
  }

  return (
    <div className="grid size-12 shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-md">
      {covers.map((image, index) => (
        <img
          key={index}
          src={apiUrl(`/api/images/serve?imagePath=${image}`)}
          alt=""
          className="size-full object-cover"
        />
      ))}
    </div>
  );
}

function CrateRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="size-12 shrink-0 rounded-md" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

export function MergePlaylistsDialog({ open, onOpenChange, playlist }: MergePlaylistsDialogProps) {
  const router = useRouter();
  const { playlists, loading } = usePlaylists();
  const mergeMutation = useMergePlaylists();

  const [query, setQuery] = useState('');
  const [targetPlaylist, setTargetPlaylist] = useState<Playlist | null>(null);
  const [name, setName] = useState('');

  const candidates = useMemo(
    () => playlists.filter((p) => p.id !== playlist?.id),
    [playlists, playlist?.id],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? candidates.filter((p) => p.name.toLowerCase().includes(q)) : candidates;
  }, [candidates, query]);

  const resetAndClose = () => {
    setQuery('');
    setTargetPlaylist(null);
    setName('');
    onOpenChange(false);
  };

  const handleSelectPlaylist = (target: Playlist) => {
    setTargetPlaylist(target);
    setName(`${playlist?.name ?? ''} + ${target.name}`);
  };

  const handleConfirm = async () => {
    if (!playlist || !targetPlaylist || !name.trim()) return;
    try {
      const merged = await mergeMutation.mutateAsync({
        sourceIdA: playlist.id,
        sourceIdB: targetPlaylist.id,
        name: name.trim(),
      });
      resetAndClose();
      router.navigate({ to: '/playlists/$playlistId', params: { playlistId: merged.id } });
    } catch (error) {
      console.error('Failed to merge playlists:', error);
    }
  };

  // Belt-and-braces for the Radix "menu → dialog" stack — see select-playlist-dialog.tsx.
  React.useEffect(() => {
    if (open) return;
    if (document.body.style.pointerEvents === 'none') {
      document.body.style.pointerEvents = '';
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : resetAndClose())}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {!targetPlaylist ? (
          <>
            <DialogHeader className="gap-3 px-6 pt-6 pb-4 text-left">
              <DialogTitle className="text-base">Merge into a new crate</DialogTitle>
              <DialogDescription>
                Choose a crate to merge with{' '}
                <span className="font-medium text-foreground">{playlist?.name}</span>. A new crate
                is created with tracks from both — the originals stay untouched.
              </DialogDescription>
            </DialogHeader>

            <div className="border-t border-sidebar-border px-6 py-3">
              <div className="relative">
                <Search
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a crate…"
                  aria-label="Find a crate"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
              {loading ? (
                <div className="divide-y divide-sidebar-border/60">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <CrateRowSkeleton key={i} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {query.trim()
                    ? `No crate matches “${query.trim()}”.`
                    : 'No other crates to merge with yet.'}
                </div>
              ) : (
                <ul className="divide-y divide-sidebar-border/60">
                  {filtered.map((candidate) => {
                    const count = candidate.stats?.numberOfTracks ?? 0;
                    return (
                      <li key={candidate.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectPlaylist(candidate)}
                          className={cn(
                            'group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                            'cursor-pointer hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                          )}
                        >
                          <CrateCover images={candidate.stats?.images ?? []} name={candidate.name} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold capitalize">
                              {candidate.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              <span className="font-mono">{count}</span>{' '}
                              {count === 1 ? 'track' : 'tracks'}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="gap-3 px-6 pt-6 pb-4 text-left">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 w-fit"
                onClick={() => setTargetPlaylist(null)}
              >
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </Button>
              <DialogTitle className="text-base">Name the merged crate</DialogTitle>
              <DialogDescription>
                Merging <span className="font-medium text-foreground">{playlist?.name}</span> with{' '}
                <span className="font-medium text-foreground">{targetPlaylist.name}</span>.
                Duplicate tracks are only kept once.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-4">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Merged crate name"
                aria-label="Merged crate name"
              />
            </div>

            <DialogFooter className="border-t border-sidebar-border px-6 py-4">
              <Button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!name.trim() || mergeMutation.isPending}
              >
                {mergeMutation.isPending ? 'Merging…' : 'Merge crates'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
