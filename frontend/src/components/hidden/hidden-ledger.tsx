import type { HiddenTrack } from '@/__generated__/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader, Undo2 } from 'lucide-react';
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
import { HIDDEN_GRID, HiddenLedgerRow } from './hidden-ledger-row';
import type { HiddenSortKey, SortDirection } from './hidden-types';

interface HiddenLedgerProps {
  data: HiddenTrack[];
  sortKey: HiddenSortKey;
  sortDirection: SortDirection;
  onSortChange: (key: HiddenSortKey) => void;
  onRestore: (track: HiddenTrack) => void;
  onBulkRestore: (tracks: HiddenTrack[]) => void;
  isRestoring: boolean;
}

const HEADERS: { key: HiddenSortKey; label: string; className: string }[] = [
  { key: 'title', label: 'Title / Artist', className: 'justify-start' },
  { key: 'createdAt', label: 'Hidden', className: 'hidden md:flex justify-end' },
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

export function HiddenLedger({
  data,
  sortKey,
  sortDirection,
  onSortChange,
  onRestore,
  onBulkRestore,
  isRestoring,
}: HiddenLedgerProps) {
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  const [cursorActive, setCursorActive] = React.useState(false);
  const [previewingId, setPreviewingId] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const togglePreview = React.useCallback((track: HiddenTrack) => {
    setPreviewingId((current) => (current === track.id ? null : track.id));
  }, []);

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

  const runBulkRestore = React.useCallback(() => {
    onBulkRestore(selectedVisible);
    setSelected(new Set());
    setConfirmOpen(false);
  }, [onBulkRestore, selectedVisible]);

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
        case 'x':
        case 'Enter':
          if (!cursorActive || !current || isRestoring) return;
          event.preventDefault();
          onRestore(current);
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [data, cursor, cursorActive, onRestore, isRestoring]);

  React.useEffect(() => {
    if (!cursorActive) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-row-index="${cursor}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [cursor, cursorActive, reduceMotion]);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className={cn(HIDDEN_GRID, 'border-b py-2 font-medium text-muted-foreground text-xs')}>
        <div className="flex items-center justify-center">
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(value) => toggleAll(!!value)}
            aria-label="Select all hidden tracks"
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

      <div ref={listRef} role="rowgroup" className="divide-y">
        {data.map((track, index) => (
          <div key={track.id} data-row-index={index}>
            <HiddenLedgerRow
              track={track}
              selected={selected.has(track.id)}
              onSelectedChange={(value) => toggleOne(track.id, value)}
              anySelected={selectedVisible.length > 0}
              onRestore={onRestore}
              isRestoring={isRestoring}
              focused={cursorActive && cursor === index}
              onFocus={() => {
                setCursorActive(false);
                setCursor(index);
              }}
              isPreviewing={previewingId === track.id}
              onTogglePreview={togglePreview}
            />
          </div>
        ))}
      </div>

      <BulkBar
        count={selectedVisible.length}
        isPending={isRestoring}
        onClear={() => setSelected(new Set())}
        onRestore={() => setConfirmOpen(true)}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore {selectedVisible.length} {selectedVisible.length === 1 ? 'track' : 'tracks'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They'll be added back to your library and re-analyzed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BulkBar({
  count,
  isPending,
  onClear,
  onRestore,
}: {
  count: number;
  isPending: boolean;
  onClear: () => void;
  onRestore: () => void;
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
          <Button variant="ghost" size="sm" onClick={onRestore} disabled={isPending}>
            {isPending ? (
              <Loader className="size-4 animate-spin" aria-hidden />
            ) : (
              <Undo2 className="size-4" aria-hidden />
            )}
            Restore
          </Button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
