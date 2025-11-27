import { AppSidebar } from '@/components/layout/app-sidebar';
import { EnhancedMusicPlayer } from '@/components/player/enhanced-music-player';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import {
  AudioPlayerProvider,
  useCurrentTrack,
} from '@/contexts/audio-player-context';
import { FilterProvider } from '@/contexts/filter-context';
import { useMusicPlayerWebSocket } from '@/hooks/useMusicPlayerWebSocket';
import { cn } from '@/lib/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import * as React from 'react';

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Music Player Inset Component - similar to SidebarInset
const MusicPlayerInset = React.memo(function MusicPlayerInset({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { currentTrack } = useCurrentTrack();
  const hasPlayer = !!currentTrack;

  return (
    <div
      className={cn(
        'relative flex w-full flex-1 flex-col transition-[margin-bottom] duration-200 ease-linear',
        hasPlayer ? 'mb-20 sm:mb-16' : 'mb-0',
        className,
      )}
      {...props}
    />
  );
});

const RootComponent = React.memo(function RootComponent() {
  // Initialize music player WebSocket connection
  useMusicPlayerWebSocket({
    autoConnect: true,
  });

  // Memoize callback to prevent re-renders
  const handleToggleShuffle = React.useCallback(() => {
    console.log('Toggle shuffle');
  }, []);
  console.log('render');
  return (
    <QueryClientProvider client={queryClient}>
      <FilterProvider>
        <AudioPlayerProvider>
          <SidebarProvider defaultOpen={false}>
            <AppSidebar />
            <SidebarInset>
              <MusicPlayerInset>
                <div className="relative">
                  <div className="fixed  w-full h-12  bg-primary-foreground z-10">
                    <SiteHeader />
                  </div>
                  <main className="relative pt-12 bg-primary dark:bg-primary-foreground min-h-screen">
                    <Outlet />
                  </main>
                </div>
              </MusicPlayerInset>
            </SidebarInset>

            {/* Enhanced Music Player - fixed at bottom, outside SidebarInset */}
            <EnhancedMusicPlayer
              onToggleShuffle={handleToggleShuffle}
              showVisualizations={true}
            />
          </SidebarProvider>
        </AudioPlayerProvider>
      </FilterProvider>
      {/*       <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      <TanStackRouterDevtools position="top-right" />
 */}{' '}
    </QueryClientProvider>
  );
});

export const Route = createRootRoute({
  component: RootComponent,
});
