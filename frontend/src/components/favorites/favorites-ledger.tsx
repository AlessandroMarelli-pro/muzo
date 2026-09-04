import type { Track } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn, isHarmonicTransition, toCamelotCode } from '@/lib/utils';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowUp, ChevronsUpDown, HeartOff, Loader } from 'lucide-react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FAVORITES_GRID, FavoritesLedgerRow } from './favorites-ledger-row';
import type { FavoriteTrack, FavoritesSortKey, SortDirection } from './favorites-types';

interface FavoritesLedgerProps {
  data: FavoriteTrack[];
  sortKey: FavoritesSortKey;
  sortDirection: SortDirection;
  onSortChange: (key: FavoritesSortKey) => void;
  onTogglePlay: (track: Track) => void;
  onRemove: (track: Track) => void;
  onBulkRemove: (tracks: Track[]) => void;
  currentTrackId?: string;
  currentTrackKey?: string | null;
  isPlaying: boolean;
  isRemoving: boolean;
}

const HEADERS: { key: FavoritesSortKey; label: string; className: string }[] = [
  { key: 'title', label: 'Title / Artist', className: 'justify-start' },
  { key: 'mfTempo', label: 'BPM', className: 'hidden md:flex justify-end' },
  { key: 'mfKey', label: 'Key', className: 'hidden md:flex justify-end' },
  { key: 'addedAt', label: 'Added', className: 'hidden md:flex justify-end' },
];

function SortButton({
  active,
  direction,
  label,
  className,
  onClick,
}: {
  active: boolean;
  direction: SortDirection;
  label: string;
  className: string;
  onClick: () => void;
}) {
  const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${active ? `, currently ${direction}ending` : ''}`}
      className={cn(
        'flex items-center gap-1 rounded-sm py-0.5 text-xs uppercase tracking-wide transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        active ? 'text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      <span>{label}</span>
      <Icon className="size-3" aria-hidden />
    </button>
  );
}

export function FavoritesLedger({
  data,
  sortKey,
  sortDirection,
  onSortChange,
  onTogglePlay,
  onRemove,
  onBulkRemove,
  currentTrackId,
  currentTrackKey,
  isPlaying,
  isRemoving,
}: FavoritesLedgerProps) {
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  // The keyboard cursor stays invisible until the user actually presses j/k, so
  // row 0 doesn't sit with a focus ring at rest.
  const [cursorActive, setCursorActive] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Selection can only hold ids that are still on screen (search may have
  // filtered some away).
  const visibleIds = React.useMemo(() => new Set(data.map((t) => t.id)), [data]);
  const selectedVisible = React.useMemo(
    () => data.filter((t) => selected.has(t.id)),
    [data, selected],
  );
  React.useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);

  React.useEffect(() => {
    if (cursor > data.length - 1) setCursor(Math.max(0, data.length - 1));
  }, [data.length, cursor]);

  const allSelected = data.length > 0 && selectedVisible.length === data.length;
  const someSelected = selectedVisible.length > 0 && !allSelected;

  const toggleAll = React.useCallback(
    (value: boolean) => {
      setSelected(value ? new Set(data.map((t) => t.id)) : new Set());
    },
    [data],
  );

  const toggleOne = React.useCallback((id: string, value: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const runBulkRemove = React.useCallback(() => {
    onBulkRemove(selectedVisible);
    setSelected(new Set());
    setConfirmOpen(false);
  }, [onBulkRemove, selectedVisible]);

  // Keyboard triage — j/k move a cursor, space plays it, x removes it. Disabled
  // while the user is typing (search box, any input/textarea/contenteditable).
  React.useEffect(() => {
    function isTyping() {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable ||
        el.getAttribute('role') === 'textbox'
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isTyping() || event.metaKey || event.ctrlKey || event.altKey) return;
      const current = data[cursor];

      switch (event.key) {
        case 'j':
        case 'ArrowDown':
          if (!data.length) return;
          event.preventDefault();
          setCursorActive(true);
          setCursor((c) => (cursorActive ? Math.min(c + 1, data.length - 1) : c));
          break;
        case 'k':
        case 'ArrowUp':
          if (!data.length) return;
          event.preventDefault();
          setCursorActive(true);
          setCursor((c) => (cursorActive ? Math.max(c - 1, 0) : c));
          break;
        case ' ':
        case 'Enter':
          if (!cursorActive || !current) return;
          event.preventDefault();
          onTogglePlay(current);
          break;
        case 'x':
        case 'Backspace':
        case 'Delete':
          if (!cursorActive || !current || isRemoving) return;
          event.preventDefault();
          onRemove(current);
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [data, cursor, cursorActive, onTogglePlay, onRemove, isRemoving]);

  // Keep the cursor row in view as it moves.
  React.useEffect(() => {
    if (!cursorActive) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-row-index="${cursor}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [cursor, cursorActive, reduceMotion]);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Header */}
      <div
        className={cn(
          FAVORITES_GRID,
          'border-b py-2 font-medium text-muted-foreground text-xs',
        )}
      >
        <div className="flex items-center justify-center">
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(value) => toggleAll(!!value)}
            aria-label="Select all favorites"
          />
        </div>
        <span aria-hidden />
        {HEADERS.map((h) => (
          <SortButton
            key={h.key}
            active={sortKey === h.key}
            direction={sortDirection}
            label={h.label}
            className={h.className}
            onClick={() => onSortChange(h.key)}
          />
        ))}
        <span aria-hidden />
      </div>

      {/* Rows */}
      <div ref={listRef} role="rowgroup" className="divide-y">
        {data.map((track, index) => {
          const isCurrent = currentTrackId === track.id;
          const rowKey = track.mfCamelotKey || track.mfKey;
          // Only hint when BOTH keys are known — `isHarmonicTransition` is
          // permissive about unknowns, which would light up every row.
          const harmonicMatch =
            !isCurrent &&
            !!currentTrackId &&
            !!toCamelotCode(currentTrackKey) &&
            !!toCamelotCode(rowKey) &&
            isHarmonicTransition(currentTrackKey, rowKey);
          return (
            <div key={track.id} data-row-index={index}>
              <FavoritesLedgerRow
                track={track}
                selected={selected.has(track.id)}
                onSelectedChange={(value) => toggleOne(track.id, value)}
                anySelected={selectedVisible.length > 0}
                isCurrent={isCurrent}
                isPlaying={isPlaying}
                harmonicMatch={harmonicMatch}
                onTogglePlay={onTogglePlay}
                onRemove={onRemove}
                isRemoving={isRemoving}
                focused={cursorActive && cursor === index}
                onFocus={() => {
                  setCursorActive(false);
                  setCursor(index);
                }}
              />
            </div>
          );
        })}
      </div>

      <BulkBar
        count={selectedVisible.length}
        isPending={isRemoving}
        onClear={() => setSelected(new Set())}
        onRemove={() => setConfirmOpen(true)}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {selectedVisible.length}{' '}
              {selectedVisible.length === 1 ? 'track' : 'tracks'} from favorites?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They stay in your library — only the heart is cleared. You can re-favorite them
              anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Floating selection bar — same shape as `DataTableActionBar`, without the table coupling. */
function BulkBar({
  count,
  isPending,
  onClear,
  onRemove,
}: {
  count: number;
  isPending: boolean;
  onClear: () => void;
  onRemove: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useLayoutEffect(() => setMounted(true), []);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && count > 0) onClear();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [count, onClear]);

  if (!mounted) return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          role="toolbar"
          aria-orientation="horizontal"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 bottom-24 z-50 mx-auto flex w-fit flex-wrap items-center justify-center gap-2 rounded-md border bg-background p-2 text-foreground shadow-md sm:bottom-20"
        >
          <span className="px-2 text-sm tabular-nums">
            <span className="font-medium">{count}</span> selected
          </span>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
          <Button variant="ghost" size="sm" onClick={onRemove} disabled={isPending}>
            {isPending ? (
              <Loader className="size-4 animate-spin" aria-hidden />
            ) : (
              <HeartOff className="size-4" aria-hidden />
            )}
            Remove from favorites
          </Button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
