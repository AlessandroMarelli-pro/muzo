import { User } from '@/__generated__/types';
import { AppSidebar, AppSidebarProps } from '@/components/layout/app-sidebar';
import { EnhancedMusicPlayer } from '@/components/player/enhanced-music-player';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { AudioPlayerProvider, useCurrentTrack } from '@/contexts/audio-player-context';
import { FilterProvider } from '@/contexts/filter-context';
import { ScanSessionProvider } from '@/contexts/scan-session.context';
import { cn } from '@/lib/utils';
import { queryClient } from '@/query-client';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
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
  Heart,
  Home,
  Library,
  ListMusic,
  Settings,
  Sparkles,
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
      title: 'Research',
      url: '/research',
      icon: Brain,
      preload: false,
    },
    {
      title: 'Swipe',
      url: '/swipe',
      icon: Sparkles,
      preload: false,
    },
    {
      title: 'Pending',
      url: '/pending',
      icon: Clock3,
      preload: false,
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
    {
      title: 'Libraries',
      url: '/libraries',
      icon: Library,
    },
  ],
};
function RootContent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const isAuthPage = pathname === '/login' || pathname === '/sign-up';

  const { resolvedTheme } = useTheme();
  const [sidebarDefaultOpen] = React.useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('sidebar_state') === 'expanded' : false,
  );

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
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <AppSidebar data={navigationData} />

        <SidebarInset>
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
});
