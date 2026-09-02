import { Disc3 } from 'lucide-react';
import * as React from 'react';

import { CrateStrip } from '@/components/layout/crate-strip';
import { RailLabel } from '@/components/layout/rail-label';
import { NavMain, type NavSection } from '@/components/nav-main';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/auth-context';
import { Link } from '@tanstack/react-router';
import { NavUser } from '../nav-user';

export interface AppSidebarProps {
  data: {
    sections: NavSection[];
  };
}

export function AppSidebar({
  data,
  ...props
}: React.ComponentProps<typeof Sidebar> & AppSidebarProps) {
  const { user } = useAuth();

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      {/* The crate label — the record-box mark, centred at the top. */}
      <SidebarHeader className="items-center px-0 pb-3 pt-3">
        <RailLabel label="Muzo — Crate room">
          <Link
            to="/"
            aria-label="Muzo — home"
            className="group/disc flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-xs outline-none ring-sidebar-ring ring-offset-2 ring-offset-sidebar transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 focus-visible:ring-2 active:scale-95 motion-reduce:transform-none"
          >
            <Disc3 className="size-[1.15rem] transition-transform duration-500 ease-out group-hover/disc:rotate-180 motion-reduce:transform-none" />
          </Link>
        </RailLabel>
      </SidebarHeader>

      <SidebarContent className="items-center gap-0 overflow-hidden px-0">
        <NavMain sections={data.sections} />
        <div className="mb-2 mt-1 h-px w-7 shrink-0 bg-sidebar-border/70" />
        <CrateStrip />
      </SidebarContent>

      {/* The account tile, filed at the base of the box. */}
      <SidebarFooter className="items-center px-0 pb-2 pt-1">
        <NavUser
          user={{
            name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Guest',
            email: user?.email ?? '',
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
