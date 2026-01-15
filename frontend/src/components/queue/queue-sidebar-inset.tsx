import { cn } from '@/lib/utils';
import * as React from 'react';

const QUEUE_SIDEBAR_WIDTH = '20rem';

const QueueSidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    queueOpen?: boolean;
  }
>(({ className, queueOpen = false, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="queue-sidebar-inset"
      className={cn(
        'relative flex w-full flex-1 flex-col bg-background',
        'md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow',
        'w-[calc(99vw-var(--queue-sidebar-width))]',
        className,
      )}
      style={
        queueOpen
          ? ({
              '--queue-sidebar-width': QUEUE_SIDEBAR_WIDTH,
            } as React.CSSProperties)
          : undefined
      }
      {...props}
    />
  );
});
QueueSidebarInset.displayName = 'QueueSidebarInset';

export { QueueSidebarInset };
