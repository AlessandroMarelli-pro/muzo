import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBlocker } from '@tanstack/react-router';
import * as React from 'react';

/**
 * Tracks which Settings sections have unsaved edits and blocks navigation while
 * any do. Secrets are high-stakes, low-feedback input — pasting an API key and
 * then losing it to a stray click is the worst thing this surface can do — so a
 * dirty section earns a themed confirm before the route changes.
 *
 * Switching between sections keeps every section mounted (see settings-shell),
 * so this only fires on a real departure from /settings or a tab close.
 */

interface SettingsDirtyContextValue {
  dirtySections: ReadonlySet<string>;
  setSectionDirty: (section: string, dirty: boolean) => void;
}

const SettingsDirtyContext = React.createContext<SettingsDirtyContextValue | null>(null);

export function SettingsDirtyProvider({ children }: { children: React.ReactNode }) {
  const [dirtySections, setDirtySections] = React.useState<ReadonlySet<string>>(new Set());

  const setSectionDirty = React.useCallback((section: string, dirty: boolean) => {
    setDirtySections((prev) => {
      const has = prev.has(section);
      if (dirty === has) return prev;
      const next = new Set(prev);
      if (dirty) next.add(section);
      else next.delete(section);
      return next;
    });
  }, []);

  const anyDirty = dirtySections.size > 0;

  const { status, proceed, reset } = useBlocker({
    // Only a real departure from /settings — switching sections is a search-param
    // change on the same path and keeps every section mounted, so it never loses input.
    shouldBlockFn: ({ current, next }) => anyDirty && current.pathname !== next.pathname,
    enableBeforeUnload: anyDirty,
    withResolver: true,
  });

  const value = React.useMemo(
    () => ({ dirtySections, setSectionDirty }),
    [dirtySections, setSectionDirty],
  );

  return (
    <SettingsDirtyContext.Provider value={value}>
      {children}
      <AlertDialog open={status === 'blocked'} onOpenChange={(open) => !open && reset?.()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in Settings. Anything you typed but didn&apos;t save will be
              lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => reset?.()}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => proceed?.()}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsDirtyContext.Provider>
  );
}

/**
 * Report a section's dirty state to the shell. Pass the current value; the hook
 * keeps the shared set in sync and clears the flag on unmount.
 */
export function useSectionDirty(section: string, dirty: boolean) {
  const ctx = React.useContext(SettingsDirtyContext);
  if (!ctx) throw new Error('useSectionDirty must be used within SettingsDirtyProvider');
  const { setSectionDirty } = ctx;

  React.useEffect(() => {
    setSectionDirty(section, dirty);
  }, [section, dirty, setSectionDirty]);

  React.useEffect(() => {
    return () => setSectionDirty(section, false);
  }, [section, setSectionDirty]);
}

export function useSettingsDirty() {
  const ctx = React.useContext(SettingsDirtyContext);
  if (!ctx) throw new Error('useSettingsDirty must be used within SettingsDirtyProvider');
  return ctx;
}
