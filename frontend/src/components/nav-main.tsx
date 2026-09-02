import { type LucideIcon } from 'lucide-react';

import { RailLabel } from '@/components/layout/rail-label';
import { cn } from '@/lib/utils';
import { Link, useLocation } from '@tanstack/react-router';

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  preload?: 'render' | 'intent' | false | 'viewport' | undefined;
}

export interface NavSection {
  /** Groups are separated by a gap in the rail; the label is not rendered. */
  label: string;
  items: NavItem[];
}

/** True when `pathname` is `url` or a descendant of it (segment-boundary safe). */
function matchesRoute(pathname: string, url: string) {
  if (url === '/') return pathname === '/';
  return pathname === url || pathname.startsWith(`${url}/`);
}

/**
 * The single active item is the one with the longest matching URL, so
 * `/music/harmonic` lights "Harmonic" and not its "/music" ancestor.
 */
function activeUrl(pathname: string, urls: string[]) {
  return urls.filter((url) => matchesRoute(pathname, url)).sort((a, b) => b.length - a.length)[0];
}

/**
 * The nav block of the rail: icon-only cells, grouped by a gap, with the
 * current route lit as a filled rounded cell and a periwinkle tick flush to
 * the rail's left edge. Labels float in a pill on hover.
 */
export function NavMain({ sections }: { sections: NavSection[] }) {
  const location = useLocation();

  // The <Link> owns navigation; this only records the transient "app has
  // navigated at least once" flag that route loaders read for skeleton state.
  const markLoaded = () => sessionStorage.setItem('isLoaded', 'true');

  const currentActive = activeUrl(
    location.pathname,
    sections.flatMap((section) => section.items.map((item) => item.url)),
  );

  return (
    <nav className="flex shrink-0 flex-col items-center px-0 pb-2 pt-1">
      {sections.map((section, sectionIndex) => (
        <ul
          key={section.label}
          aria-label={section.label}
          className={cn(
            'flex flex-col items-center gap-1',
            // A clear finger-gap between filed groups.
            sectionIndex > 0 && 'mt-5',
          )}
        >
          {section.items.map((item) => {
            const Icon = item.icon;
            const isActive = item.url === currentActive;

            return (
              <li key={item.title}>
                <RailLabel label={item.title}>
                  <Link
                    to={item.url}
                    onClick={markLoaded}
                    preload={item.preload}
                    aria-label={item.title}
                    aria-current={isActive ? 'page' : undefined}
                    data-active={isActive}
                    className={cn(
                      'group/cell relative flex size-10 items-center justify-center rounded-xl',
                      'text-sidebar-foreground/75 outline-none transition-colors duration-150',
                      'ring-sidebar-ring ring-offset-2 ring-offset-sidebar focus-visible:ring-2',
                      'hover:bg-sidebar-accent hover:text-sidebar-foreground',
                      // Active: filled cell + a tick flush to the rail edge.
                      'data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground',
                      'data-[active=true]:before:absolute data-[active=true]:before:-left-[13px] data-[active=true]:before:h-5 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-sidebar-primary',
                    )}
                  >
                    <Icon className="size-[1.15rem]" />
                  </Link>
                </RailLabel>
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );
}
