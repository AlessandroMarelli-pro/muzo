'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useQueue, useResetQueue } from '@/services/queue-hooks';
import { RefreshCcwIcon, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { Button } from '../ui/button';
import { QueueList } from './queue-list';

interface QueueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Height in px of the fixed player bar this panel should sit above. */
  offsetBottom?: number;
}

/**
 * A panel that rises out of the player bar. It is not a modal — it doesn't
 * trap focus or dim the app; it's an extension of the transport that happens
 * to hold the queue. Anchored bottom-right, docked flush to the player.
 */
export function QueueDrawer({ open, onOpenChange, offsetBottom = 0 }: QueueDrawerProps) {
  const { data: queueItems = [] } = useQueue();
  const resetQueueMutation = useResetQueue();

  // Esc closes it, matching the affordance of a dismissible surface.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Transparent catcher — a click outside dismisses, but the app
              stays fully lit and interactive underneath. */}
          <motion.div
            className="fixed inset-0 z-[var(--z-player)]"
            style={{ bottom: offsetBottom }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => onOpenChange(false)}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-label="Playback queue"
            className={cn(
              'fixed right-0 z-[var(--z-player-overlay)] flex w-full flex-col overflow-hidden',
              'border border-b-0 border-border bg-card text-card-foreground',
              'rounded-t-xl shadow-xl sm:right-3 sm:w-160',
            )}
            style={{
              bottom: offsetBottom,
              maxHeight: `min(32rem, calc(100vh - ${offsetBottom}px - 2rem))`,
            }}
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">Queue</h2>
              {queueItems.length > 0 && (
                <span className="text-sm font-normal tabular-nums text-muted-foreground">
                  {queueItems.length}
                </span>
              )}
              <div className="flex-1" />
              {queueItems.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      className="size-8"
                      aria-label="Clear queue"
                    >
                      <RefreshCcwIcon className="size-4" aria-hidden />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear the queue?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes all {queueItems.length} track
                        {queueItems.length === 1 ? '' : 's'} from the queue. This can't be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => resetQueueMutation.mutate()}>
                        Clear queue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                variant="ghost"
                size="iconSm"
                className="size-8"
                onClick={() => onOpenChange(false)}
                aria-label="Close queue"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <QueueList />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
