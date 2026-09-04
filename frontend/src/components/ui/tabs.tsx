'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

/**
 * The active-tab marker travels the way the nav rail's does: one
 * absolutely-positioned element that slides between triggers on a CSS
 * transform transition, rather than a per-trigger background swap. The list
 * measures its active trigger (Radix flips `data-state` on it) and places the
 * marker over it, re-measuring on tab change and on resize.
 */
function TabsList({ className, children, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [marker, setMarker] = React.useState<{ left: number; width: number } | null>(null);
  // Suppress the slide on the first placement so the marker doesn't fly in
  // from the left on page load; it animates on every change after that.
  const [ready, setReady] = React.useState(false);

  const measure = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLButtonElement>(
      '[data-slot="tabs-trigger"][data-state="active"]',
    );
    setMarker(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
  }, []);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const attrs = new MutationObserver(measure);
    attrs.observe(list, { attributes: true, attributeFilter: ['data-state'], subtree: true });

    const resize = new ResizeObserver(measure);
    resize.observe(list);

    measure();
    const raf = requestAnimationFrame(() => setReady(true));
    return () => {
      cancelAnimationFrame(raf);
      attrs.disconnect();
      resize.disconnect();
    };
  }, [measure]);

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      className={cn(
        'bg-muted text-muted-foreground relative inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
        className,
      )}
      {...props}
    >
      {marker ? (
        <span
          aria-hidden
          style={{ transform: `translateX(${marker.left}px)`, width: marker.width }}
          className={cn(
            'bg-background dark:bg-input/30 dark:border-input pointer-events-none absolute left-0 top-[3px] bottom-[3px] z-0 rounded-md border border-transparent shadow-sm',
            ready &&
              'transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
          )}
        />
      ) : null}
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // The travelling marker (in TabsList) carries the active surface; the
        // trigger only flips its ink and sits above the marker.
        "dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground dark:text-muted-foreground relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
