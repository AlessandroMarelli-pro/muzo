import { QueueDrawer } from '@/components/queue/queue-sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useQueue } from '@/services/queue-hooks';
import { useLocation } from '@tanstack/react-router';

import { ListMusic, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { ScanProgress } from './scan-progress';

interface SiteHeaderProps { }

export function SiteHeader({ }: SiteHeaderProps) {
  const [queueOpen, setQueueOpen] = useState(false);
  const location = useLocation();
  const { setTheme, resolvedTheme } = useTheme();
  const { data: queueItems = [] } = useQueue();

  const isDark = resolvedTheme === 'dark';

  // Keyboard shortcut: CMD+J (Mac) or Ctrl+J (Windows/Linux) to toggle theme
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Check for CMD+J (Mac) or Ctrl+J (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setTheme(isDark ? 'light' : 'dark');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDark, setTheme]);

  // Get the current page title from the pathname
  const getPageTitle = (pathname: string) => {
    if (pathname === '/') return 'Home';
    if (pathname === '/music') return 'Music';
    if (pathname === '/categories') return 'Categories';
    if (pathname === '/libraries') return 'Libraries';
    if (pathname.startsWith('/libraries/')) return 'Library Dashboard';
    if (pathname === '/playlists') return 'Playlists';
    if (pathname.startsWith('/playlists/')) return 'Playlist Details';
    if (pathname === '/favorites') return 'Favorites';
    if (pathname === '/settings') return 'Settings';
    if (pathname === '/research') return 'Research';
    return 'Muzo';
  };

  return (
    <header className="relative group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6 ">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex items-center justify-between gap-2 w-full px-2 py-1.5">
          <span className="font-normal text-foreground min-w-md">
            {getPageTitle(location.pathname)}
          </span>

          <div className="flex items-center justify-end gap-2 px-2 py-1.5 w-full">
            <ScanProgress />
            <Switch
              checked={isDark}
              onCheckedChange={(checked: boolean) =>
                setTheme(checked ? 'dark' : 'light')
              }
              aria-label="Toggle night mode"
            >
              {isDark ? (
                <Moon className="size-3 text-sidebar-foreground transition-all duration-300" />
              ) : (
                <Sun className="size-3 text-sidebar-foreground transition-all duration-300" />
              )}
            </Switch>
          </div>
        </div>
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />{' '}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 relative"
          onClick={() => setQueueOpen(!queueOpen)}
          aria-label="Toggle queue"
        >
          <ListMusic className="h-4 w-4" />
          {queueItems.length > 0 && (
            <Badge
              variant="secondary"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {queueItems.length}
            </Badge>
          )}
        </Button>
      </div>
      <QueueDrawer open={queueOpen} onOpenChange={setQueueOpen} />
    </header>
  );
}
