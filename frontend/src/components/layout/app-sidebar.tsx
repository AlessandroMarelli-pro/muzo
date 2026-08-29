'use client';

import { DogIcon, LucideIcon } from 'lucide-react';
import * as React from 'react';

import { NavMain } from '@/components/nav-main';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/auth-context';
import { NavUser } from '../nav-user';

export interface NavMainItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
  preload?: 'render' | 'intent' | false | 'viewport' | undefined;
  items?: {
    title: string;
    url: string;
  }[];
}
export interface AppSidebarProps {
  data: {
    navMain: NavMainItem[];
    user: {
      name: string;
      email: string;
      avatar: string;
    };
  };
}
export function AppSidebar({
  data,
  ...props
}: React.ComponentProps<typeof Sidebar> & AppSidebarProps) {
  const { user } = useAuth();
  return (
    <Sidebar collapsible="icon" variant="inset" {...props} className="h-[92%]">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="h-12 group-data-[collapsible=icon]:!size-12 gap-2 group-data-[collapsible=icon]:hover:bg-sidebar"
            >
              <a href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <DogIcon className="size-4" />
                </div>
                <div className=" flex-1 text-left text-sm leading-tight grid group-data-[collapsible=icon]:hidden ">
                  <span className="truncate font-semibold">Muzo</span>
                  <span className="truncate text-xs">Music Organizer</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="flex flex-col gap-2 justify-between">
        <NavMain items={data.navMain} />
        <NavUser
          user={{
            name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Guest',
            email: user?.email ?? '',
            avatar: '',
          }}
        />
      </SidebarContent>
    </Sidebar>
  );
}
