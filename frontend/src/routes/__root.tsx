import { User } from '@/__generated__/types';
import { AppSidebar, AppSidebarProps } from '@/components/layout/app-sidebar';
import { EnhancedMusicPlayer } from '@/components/player/enhanced-music-player';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AudioPlayerProvider, useCurrentTrack } from '@/contexts/audio-player-context';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { FilterProvider } from '@/contexts/filter-context';
import { ScanSessionProvider } from '@/contexts/scan-session.context';
import { cn } from '@/lib/utils';
import { queryClient } from '@/query-client';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouteError, RouteNotFound } from '@/components/route-error';
import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import {
  BookHeadphones,
  Brain,
  Clock3,
  Disc3,
  Heart,
  Home,
  Library,
  ListMusic,
} from 'lucide-react';
import { ThemeProvider, useTheme } from 'next-themes';
import * as React from 'react';

interface RouterContext {
  queryClient: QueryClient;
  user: User;
}

// Music Player Inset Component - similar to SidebarInset
const MusicPlayerInset = React.memo(function MusicPlayerInset({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { currentTrack } = useCurrentTrack();
  // The player bar is always docked; it grows a little on mobile when a
  // track is loaded (extra scrubber row), hence the two reserved heights.
  const hasTrack = !!currentTrack;

  return (
    <div
      className={cn(
        ' flex w-full flex-col transition-[margin-bottom] duration-200 ease-linear   h-full ',
        hasTrack ? 'mb-[7.5rem] sm:mb-[4.75rem]' : 'mb-[5.5rem] sm:mb-[4.5rem]',
        className,
      )}
      {...props}
    />
  );
});

const navigationData: AppSidebarProps['data'] = {
  sections: [
    {
      // Where the collection lives — the entry points for browsing and scanning.
      label: 'Library',
      items: [
        { title: 'Home', url: '/', icon: Home },
        { title: 'Music', url: '/music', icon: ListMusic },
        { title: 'Harmonic', url: '/music/harmonic', icon: Disc3, preload: false },
        { title: 'Libraries', url: '/libraries', icon: Library },
      ],
    },
    {
      // The off-gig prep loop: triage what came back rough, dig, favourite,
      // assemble the set.
      label: 'Prep',
      items: [
        { title: 'Pending', url: '/pending', icon: Clock3, preload: false, badge: 'pending' },
        { title: 'Research', url: '/research', icon: Brain, preload: false },
        { title: 'Favorites', url: '/favorites', icon: Heart, badge: 'favorites' },
        { title: 'Playlists', url: '/playlists', icon: BookHeadphones },
      ],
    },
  ],
};
function RootContent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const isAuthPage = pathname === '/login' || pathname === '/sign-up';

  const { resolvedTheme } = useTheme();
  // Expanded is the default; only an explicit "collapsed" preference overrides
  // it, so a first-time visitor meets the labelled rail, not a bare icon strip.
  const [sidebarDefaultOpen] = React.useState(() => {
    try {
      return localStorage.getItem('sidebar_state') !== 'collapsed';
    } catch {
      return true;
    }
  });

  React.useEffect(() => {
    document.documentElement.style.colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light';
  }, [resolvedTheme]);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated && !isAuthPage) {
      void navigate({ to: '/login' });
    }
  }, [isLoading, isAuthenticated, isAuthPage, navigate]);

  if (isLoading && !isAuthPage) {
    return null;
  }

  if (!isAuthenticated && !isAuthPage) {
    return null;
  }

  if (isAuthPage) {
    return <Outlet />;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-popover focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-popover-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <AppSidebar data={navigationData} />

        <SidebarInset id="main-content">
          <MusicPlayerInset>
            <SiteHeader />
            <Outlet />
          </MusicPlayerInset>
        </SidebarInset>
      </SidebarProvider>
      <EnhancedMusicPlayer />
    </TooltipProvider>
  );
}

const RootComponent = React.memo(function RootComponent() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <ScanSessionProvider>
          <FilterProvider>
            <AuthProvider>
              <AudioPlayerProvider>
                <RootContent />
              </AudioPlayerProvider>
            </AuthProvider>
          </FilterProvider>
        </ScanSessionProvider>
        {/* <TanStackRouterDevtools position="top-right" initialIsOpen={false} /> */}
      </QueryClientProvider>
    </ThemeProvider>
  );
});

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: ({ error }) => <RouteError error={error} />,
  notFoundComponent: () => <RouteNotFound />,
});
