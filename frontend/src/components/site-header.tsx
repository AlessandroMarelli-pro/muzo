import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useLocation } from '@tanstack/react-router';

export function SiteHeader() {
  const location = useLocation();

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
        <h1 className="text-base font-medium">
          {getPageTitle(location.pathname)}
        </h1>
        {/* <FilterButton /> */}
      </div>
    </header>
  );
}
