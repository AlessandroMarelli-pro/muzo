import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { apiUrl } from '@/lib/api-config';
import { capitalizeEveryWord, cn } from '@/lib/utils';
import { useAddTrackToPlaylist, usePlaylists } from '@/services/playlist-hooks';
import { Check, ListPlus, Loader2, Plus, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { CreatePlaylistDialog } from './create-playlist-dialog';

interface SelectPlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId: string;
  artist: string;
  title: string;
}

export const SelectPlaylistTrigger = ({
  trackId,
  isDropdownMenuItem = true,
  artist,
  title,
}: {
  trackId: string;
  isDropdownMenuItem?: boolean;
  artist: string;
  title: string;
}) => {
  const [open, setOpen] = useState(false);
  // Only mount the dialog (and its data fetch / nested Radix roots) once the
  // user has actually opened it — a closed <Dialog> per track row still stacks
  // body-scroll-lock bookkeeping that can strand `pointer-events: none`.
  const [mounted, setMounted] = useState(false);
  const handleOpen = React.useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMounted(true);
    setOpen(true);
  }, []);

  return (
    <>
      {isDropdownMenuItem ? (
        <DropdownMenuItem onPointerDown={handleOpen} onSelect={(e) => e.preventDefault()}>
          <ListPlus />
          Add to playlist
        </DropdownMenuItem>
      ) : (
        <Button onClick={handleOpen} variant="ghost" size="sm">
          {' '}
          <ListPlus className="w-4 h-4" />
        </Button>
      )}
      {mounted && (
        <SelectPlaylistDialog
          open={open}
          onOpenChange={setOpen}
          trackId={trackId}
          artist={artist}
          title={title}
        />
      )}
    </>
  );
};

/** 2×2 cover mosaic — the crate-strip pattern from the nav rail, reused at row scale. */
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

export const SelectPlaylistDialog: React.FC<SelectPlaylistDialogProps> = ({
  open,
  onOpenChange,
  trackId,
  artist,
  title,
}) => {
  const { playlists, loading, refetch } = usePlaylists(undefined, trackId);
  const addTrackMutation = useAddTrackToPlaylist();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? playlists.filter((p) => p.name.toLowerCase().includes(q))
      : playlists;
    // Crates already holding the track sink to the bottom.
    return [...list].sort(
      (a, b) => Number(!!a.containsTrack) - Number(!!b.containsTrack),
    );
  }, [playlists, query]);

  const handleSelectPlaylist = async (playlistId: string, containsTrack?: boolean | null) => {
    if (containsTrack || pendingId) return;
    setPendingId(playlistId);
    try {
      await addTrackMutation.mutateAsync({ playlistId, input: { trackId }, artist, title });
    } catch (error) {
      console.error('Failed to add track to playlist:', error);
    } finally {
      setPendingId(null);
    }
  };

  const trackLabel = capitalizeEveryWord(`${title} — ${artist}`);

  // Belt-and-braces for the Radix "menu → dialog → nested sheet" stack: if any
  // of those primitives' body-scroll-lock cleanups run out of order, a stranded
  // `pointer-events: none` on <body> freezes the whole page (the track menu
  // included). Clear it whenever this dialog is fully closed.
  React.useEffect(() => {
    if (open || createOpen) return;
    if (document.body.style.pointerEvents === 'none') {
      document.body.style.pointerEvents = '';
    }
  }, [open, createOpen]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="gap-3 px-6 pt-6 pb-4 text-left">
            <DialogTitle className="text-base">File this track in a crate</DialogTitle>
            <DialogDescription className="sr-only">
              Choose a playlist to add “{trackLabel}” to.
            </DialogDescription>
            <p className="truncate text-sm text-muted-foreground" title={trackLabel}>
              {trackLabel}
            </p>
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
                  : 'You haven’t built any crates yet.'}
              </div>
            ) : (
              <ul className="divide-y divide-sidebar-border/60">
                {filtered.map((playlist) => {
                  const added = !!playlist.containsTrack;
                  const isPending = pendingId === playlist.id;
                  const count = playlist.stats?.numberOfTracks ?? 0;
                  const genres = (playlist.stats?.topGenres ?? []).slice(0, 2).join(' · ');

                  return (
                    <li key={playlist.id}>
                      <button
                        type="button"
                        disabled={added || !!pendingId}
                        onClick={() => handleSelectPlaylist(playlist.id, playlist.containsTrack)}
                        aria-label={
                          added
                            ? `${playlist.name} — already in this crate`
                            : `Add to ${playlist.name}`
                        }
                        className={cn(
                          'group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                          added
                            ? 'cursor-default'
                            : 'cursor-pointer hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none',
                        )}
                      >
                        <span className={cn('flex shrink-0', added && 'opacity-45')}>
                          <CrateCover images={playlist.stats?.images ?? []} name={playlist.name} />
                        </span>

                        <span className={cn('min-w-0 flex-1', added && 'opacity-60')}>
                          <span className="block truncate text-sm font-semibold capitalize">
                            {playlist.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            <span className="font-mono">{count}</span>{' '}
                            {count === 1 ? 'track' : 'tracks'}
                            {genres && <span className="capitalize"> · {genres}</span>}
                          </span>
                        </span>

                        <span className="shrink-0" aria-hidden>
                          {isPending ? (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          ) : added ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-success">
                              <Check className="size-4" />
                              In crate
                            </span>
                          ) : (
                            <Plus className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-sidebar-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              New crate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {createOpen && (
        <CreatePlaylistDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={() => {
            setCreateOpen(false);
            refetch();
          }}
        />
      )}
    </>
  );
};
