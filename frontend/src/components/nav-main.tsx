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

// Rail cell geometry, in px — kept in lockstep with the classes below so the
// travelling indicator can place itself without measuring the DOM.
const CELL = 40; // size-10
const ROW_PITCH = CELL + 4; // + gap-1, within a group
const GROUP_EXTRA = 16; // a group break (mt-5, 20px) adds this over a normal row gap

/**
 * Distance (px) of a cell's top from the first cell's top, given how many cells
 * and how many group breaks precede it in the flattened list.
 */
function cellOffset(cellsBefore: number, groupsBefore: number) {
  return cellsBefore * ROW_PITCH + groupsBefore * GROUP_EXTRA;
}

/**
 * The nav block of the rail: icon-only cells, grouped by a gap, with the
 * current route lit as a filled cell. The blue field and its rail-edge tick
 * are a single element that slides from the old route's cell to the new one —
 * the "you are here" marker travelling down the record box. Labels float in a
 * pill on hover.
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

  // Resolve the active cell's pixel offset from the top of the nav block.
  let cellsBefore = 0;
  let activeOffset: number | null = null;
  sections.forEach((section, sectionIndex) => {
    section.items.forEach((item) => {
      if (item.url === currentActive) {
        activeOffset = cellOffset(cellsBefore, sectionIndex);
      }
      cellsBefore += 1;
    });
  });

  return (
    <nav className="relative flex shrink-0 flex-col items-center px-0 pb-2 pt-1">
      {/* The travelling active field — one element, sliding between cells. It
          rides above the icons' stacking context but below the links so the
          idle cells still take hover. */}
      {activeOffset !== null ? (
        <span
          aria-hidden
          style={{ transform: `translateY(${activeOffset}px)` }}
          className={cn(
            'pointer-events-none absolute left-1/2 top-1 z-0 -ml-5 size-10 rounded-xl bg-sidebar-active',
            'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
          )}
        >
          {/* The 3px tick, flush to the rail's left edge, riding along. */}
          <span className="absolute -left-[13px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary" />
        </span>
      ) : null}

      {sections.map((section, sectionIndex) => (
        <ul
          key={section.label}
          aria-label={section.label}
          className={cn(
            'relative z-10 flex flex-col items-center gap-1',
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
                      'text-sidebar-foreground/75 outline-none transition-[color,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
                      'ring-sidebar-ring ring-offset-2 ring-offset-sidebar focus-visible:ring-2',
                      'hover:bg-sidebar-accent hover:text-sidebar-foreground',
                      // The travelling field carries the active colour; the cell
                      // itself only flips its ink and suppresses the hover tint.
                      'data-[active=true]:text-sidebar-active-foreground data-[active=true]:hover:bg-transparent',
                      // A physical key-press on click.
                      'active:scale-95 motion-reduce:active:scale-100',
                    )}
                  >
                    <Icon className="size-[1.15rem] transition-transform duration-150 group-hover/cell:scale-110 group-active/cell:scale-95 motion-reduce:transform-none" />
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
