import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useLocation } from '@tanstack/react-router';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Switch } from '@/components/ui/switch';

export function SiteHeader() {
  const location = useLocation();
  const { setTheme, resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

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
          <span className="font-normal text-foreground">
            {getPageTitle(location.pathname)}
          </span>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <Switch
              checked={isDark}
              onCheckedChange={(checked: boolean) =>
                setTheme(checked ? 'dark' : 'light')
              }
              aria-label="Toggle night mode"
              className="data-[state=checked]:bg-sidebar-primary data-[state=unchecked]:bg-sidebar-primary-foreground"
            >
              {isDark ? (
                <Moon className="size-3 text-sidebar-foreground transition-all duration-300" />
              ) : (
                <Sun className="size-3 text-sidebar-foreground transition-all duration-300" />
              )}
            </Switch>
          </div>
        </div>
      </div>
    </header>
  );
}
