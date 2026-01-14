import { AppSidebar } from '@/components/layout/app-sidebar';
import { EnhancedMusicPlayer } from '@/components/player/enhanced-music-player';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import {
  AudioPlayerProvider,
  useCurrentTrack,
} from '@/contexts/audio-player-context';
import { FilterProvider } from '@/contexts/filter-context';
import { cn } from '@/lib/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import {
  BookHeadphones,
  Boxes,
  Brain,
  Heart,
  Home,
  ListMusic,
  Settings,
  Sparkles,
} from 'lucide-react';
import { ThemeProvider } from 'next-themes';
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

const navigationData = {
  navMain: [
    {
      title: 'Home',
      url: '/',
      icon: Home,
    },
    {
      title: 'Music',
      url: '/music',
      icon: ListMusic,
    },
    {
      title: 'Categories',
      url: '/categories',
      icon: Boxes,
    },
    {
      title: 'Research',
      url: '/research',
      icon: Brain,
    },
    {
      title: 'Swipe',
      url: '/swipe',
      icon: Sparkles,
    },
    {
      title: 'Playlists',
      url: '/playlists',
      icon: BookHeadphones,
    },
    {
      title: 'Favorites',
      url: '/favorites',
      icon: Heart,
    },
    {
      title: 'Settings',
      url: '/settings',
      icon: Settings,
    },
  ],
};
const RootComponent = React.memo(function RootComponent() {
  // Memoize callback to prevent re-renders
  const handleToggleShuffle = React.useCallback(() => {
    console.log('Toggle shuffle');
  }, []);
  console.log('render');
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <FilterProvider>
          <AudioPlayerProvider>
            <SidebarProvider defaultOpen={true}>
              <AppSidebar data={navigationData} />
              <SidebarInset>
                <MusicPlayerInset>
                  <SiteHeader />

                  <Outlet />
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
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
        {/* <TanStackRouterDevtools position="top-right" initialIsOpen={false} /> */}
      </QueryClientProvider>
    </ThemeProvider>
  );
});

export const Route = createRootRoute({
  component: RootComponent,
});
