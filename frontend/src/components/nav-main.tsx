import { type LucideIcon } from 'lucide-react';

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Link, useLocation } from '@tanstack/react-router';

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  preload?: 'render' | 'intent' | false | 'viewport' | undefined;
  /** Optional key for a live count badge, resolved by the parent. */
  badge?: 'pending' | 'favorites';
}

export interface NavSection {
  /** Section heading; hidden when the rail is collapsed to icons. */
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

export function NavMain({
  sections,
  counts,
}: {
  sections: NavSection[];
  counts?: Partial<Record<NonNullable<NavItem['badge']>, number>>;
}) {
  const location = useLocation();

  // The <Link> owns navigation; this only records the transient "app has
  // navigated at least once" flag that route loaders read for skeleton state.
  const markLoaded = () => sessionStorage.setItem('isLoaded', 'true');

  const currentActive = activeUrl(
    location.pathname,
    sections.flatMap((section) => section.items.map((item) => item.url)),
  );

  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.label}>
          <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          <SidebarMenu className="flex flex-col gap-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.url === currentActive;
              const count = item.badge ? counts?.[item.badge] : undefined;

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                    <Link
                      to={item.url}
                      className="flex items-center gap-2"
                      onClick={markLoaded}
                      preload={item.preload}
                    >
                      <Icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {count && count > 0 ? (
                    <SidebarMenuBadge>
                      {count > 999 ? '999+' : count.toLocaleString()}
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
