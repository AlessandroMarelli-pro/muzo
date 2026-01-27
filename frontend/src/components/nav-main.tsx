'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    preload?: 'render' | 'intent' | false | 'viewport' | undefined;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const handleNavigate = (url: string) => {
    sessionStorage.setItem('isLoaded', 'true');
    navigate({ to: url });
  };

  return (
    <SidebarGroup>
      <SidebarMenu className="flex flex-col gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          console.log('location.pathname', location.pathname, item.url);
          const isActive = location.pathname !== '/' && item.url !== '/' && location.pathname.startsWith(item.url) || location.pathname === item.url;
          return (
            <Collapsible key={item.title} asChild defaultOpen={isActive}>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isActive}
                >
                  <Link to={item.url} className="flex items-center gap-2" onClick={() => handleNavigate(item.url)} preload={item.preload}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <ChevronRight />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild>
                              <Link
                                to={subItem.url}
                                className="flex items-center gap-2"
                              >
                                <Icon className="h-4 w-4" />
                                {subItem.title}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
