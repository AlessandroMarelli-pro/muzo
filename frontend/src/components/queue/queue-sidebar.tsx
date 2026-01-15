'use client';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueue } from '@/services/queue-hooks';
import { X } from 'lucide-react';
import { QueueList } from './queue-list';

interface QueueSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUEUE_SIDEBAR_WIDTH = '20rem';
const QUEUE_SIDEBAR_WIDTH_MOBILE = '18rem';

export function QueueSidebar({ open, onOpenChange }: QueueSidebarProps) {
  const { data: queueItems = [] } = useQueue();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="bg-sidebar text-sidebar-foreground w-[--queue-sidebar-width] p-0"
          style={
            {
              '--queue-sidebar-width': QUEUE_SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
        >
          <SheetHeader className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Queue
                {queueItems.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({queueItems.length})
                  </span>
                )}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close queue</span>
              </Button>
            </div>
          </SheetHeader>
          <div className="h-full overflow-y-auto">
            <QueueList />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state="expanded"
      data-side="right"
      data-slot="queue-sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="queue-sidebar-gap"
        className="relative w-[--queue-sidebar-width] bg-transparent transition-[width] duration-200 ease-linear"
        style={
          {
            '--queue-sidebar-width': QUEUE_SIDEBAR_WIDTH,
          } as React.CSSProperties
        }
      />
      {/* Fixed sidebar for desktop */}
      <div
        className="fixed inset-y-0 right-0 z-10 hidden h-svh w-[--queue-sidebar-width] transition-[right] duration-200 ease-linear md:flex"
        style={
          {
            '--queue-sidebar-width': QUEUE_SIDEBAR_WIDTH,
          } as React.CSSProperties
        }
      >
        <div className="flex h-full w-full flex-col bg-sidebar border-l border-sidebar-border">
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Queue
                {queueItems.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({queueItems.length})
                  </span>
                )}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close queue</span>
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <QueueList />
          </div>
        </div>
      </div>
    </div>
  );
}
