'use client';

import { Command, LucideIcon, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';

import { NavMain } from '@/components/nav-main';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';

export function AppSidebar({
  data,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  data: {
    navMain: { title: string; url: string; icon: LucideIcon }[];
  };
}) {
  const { setTheme, resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  return (
    <Sidebar collapsible="offcanvas" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Acme Inc</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
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
      </SidebarFooter>
    </Sidebar>
  );
}
