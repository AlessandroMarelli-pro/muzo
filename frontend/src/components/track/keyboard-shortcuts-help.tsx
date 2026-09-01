import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HelpCircle } from 'lucide-react';

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['↑', 'Z'], label: 'Play previous track' },
  { keys: ['↓', 'S'], label: 'Play next track' },
  { keys: ['←', 'Q'], label: 'Previous page' },
  { keys: ['→', 'D'], label: 'Next page' },
];

/**
 * Surfaces the otherwise-invisible list keyboard map (arrows + AZERTY WASD).
 * Without this the nav in `useTrackKeyboardNav` is undiscoverable.
 */
export function KeyboardShortcutsHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="iconSm" aria-label="Keyboard shortcuts">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-2 font-medium text-sm">Keyboard shortcuts</p>
        <dl className="space-y-1.5">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.label} className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-muted-foreground">{shortcut.label}</dt>
              <dd className="flex gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs"
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
