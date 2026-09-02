import { LogOut, Settings } from 'lucide-react';
import { useRouter } from '@tanstack/react-router';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
  };
}) {
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut({ fetchOptions: { cache: 'no-store' } });
    await router.invalidate();
    router.navigate({ to: '/login' });
  };

  const initials =
    user.name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'G';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full outline-none ring-sidebar-ring ring-offset-2 ring-offset-sidebar transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 focus-visible:ring-2 active:scale-95 data-[state=open]:scale-105 motion-reduce:transform-none"
      >
        <Avatar className="size-9">
          <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" side="right" align="end" sideOffset={12}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary text-sm font-medium text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              {user.email ? (
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              ) : null}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.navigate({ to: '/settings' })}>
            <Settings />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
