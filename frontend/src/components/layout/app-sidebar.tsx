import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Link, useLocation } from '@tanstack/react-router';
import {
  Brain,
  Heart,
  Home,
  Library,
  ListMusic,
  Music,
  Settings,
} from 'lucide-react';
import * as React from 'react';

const navigationData = [
  {
    title: 'Main',
    items: [
      {
        title: 'Home',
        url: '/',
        icon: Home,
      },
      {
        title: 'Music',
        url: '/music',
        icon: Music,
      },
      {
        title: 'Categories',
        url: '/categories',
        icon: ListMusic,
      },
    ],
  },
  {
    title: 'Library',
    items: [
      {
        title: 'Research',
        url: '/research',
        icon: Brain,
      },
      {
        title: 'Playlists',
        url: '/playlists',
        icon: ListMusic,
      },
      {
        title: 'Favorites',
        url: '/favorites',
        icon: Heart,
      },
    ],
  },
  {
    title: 'Settings',
    items: [
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
  },
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {}

export function AppSidebar({ ...props }: AppSidebarProps) {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2  ">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg  text-primary">
            <Music className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold group-data-[collapsible=icon]:hidden">
              Muzo
            </span>
            <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              Music Library
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navigationData.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.url;

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {item.title}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
