import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useLocation } from "@tanstack/react-router";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect } from "react";

import { Switch } from "@/components/ui/switch";
import { ScanProgress } from "./scan-progress";

interface SiteHeaderProps {}

export function SiteHeader(_props: SiteHeaderProps) {
  const location = useLocation();
  const { setTheme, resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  // Keyboard shortcut: CMD+J (Mac) or Ctrl+J (Windows/Linux) to toggle theme
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Check for CMD+J (Mac) or Ctrl+J (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setTheme(isDark ? "light" : "dark");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDark, setTheme]);

  // Get the current page title from the pathname
  const getPageTitle = (pathname: string) => {
    if (pathname === "/") return "Home";
    if (pathname === "/music/harmonic") return "Harmonic Mixing";
    if (pathname === "/music") return "Music";
    if (pathname === "/pending") return "Pending";
    if (pathname === "/swipe") return "Swipe";
    if (pathname === "/libraries") return "Libraries";
    if (pathname.startsWith("/libraries/")) return "Library";
    if (pathname === "/playlists") return "Playlists";
    if (pathname.startsWith("/playlists/")) return "Playlist Details";
    if (pathname === "/favorites") return "Favorites";
    if (pathname === "/settings") return "Settings";
    if (pathname === "/similar") return "Similar";
    if (pathname.startsWith("/similar/")) return "Similar";
    return "Muzo";
  };

  return (
    <header className="relative group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6 ">
        {/* Desktop rail is fixed; the trigger only opens the mobile Sheet. */}
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4 md:hidden"
        />
        <div className="flex items-center justify-between gap-2 w-full px-2 py-1.5">
          <span className="font-normal text-foreground min-w-md">
            {getPageTitle(location.pathname)}
          </span>

          <div className="flex items-center justify-end gap-2 px-2 py-1.5 w-full">
            <ScanProgress />
            <Switch
              checked={isDark}
              onCheckedChange={(checked: boolean) =>
                setTheme(checked ? "dark" : "light")
              }
              aria-label="Toggle night mode"
            >
              {isDark ? (
                <Moon className="size-3 text-sidebar-foreground transition-[opacity,transform] duration-300" />
              ) : (
                <Sun className="size-3 text-sidebar-foreground transition-[opacity,transform] duration-300" />
              )}
            </Switch>
          </div>
        </div>
      </div>
    </header>
  );
}
