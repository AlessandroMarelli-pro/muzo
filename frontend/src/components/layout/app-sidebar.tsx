import { Disc3 } from 'lucide-react';
import * as React from 'react';

import { NavMain, type NavSection } from '@/components/nav-main';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/auth-context';
import { useSidebarCounts } from '@/hooks/use-sidebar-counts';
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
  const counts = useSidebarCounts();

  return (
    <Sidebar collapsible="icon" variant="inset" {...props} className="h-full">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="h-12 gap-2.5 group-data-[collapsible=icon]:!size-12"
            >
              <Link to="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-xs">
                  <Disc3 className="size-4" />
                </span>
                <span className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold tracking-tight">Muzo</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">Crate room</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain sections={data.sections} counts={counts} />
      </SidebarContent>

      <SidebarFooter>
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
