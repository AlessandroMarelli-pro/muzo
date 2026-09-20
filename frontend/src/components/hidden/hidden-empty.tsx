import { Button } from '@/components/ui/button';
import { EyeOff, SearchX } from 'lucide-react';

export function HiddenEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
        <EyeOff className="size-9 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-base">Nothing hidden</h3>
        <p className="max-w-xs text-muted-foreground text-sm">
          Tracks you dislike while triaging land here. Restore one anytime to bring it back into
          your library.
        </p>
      </div>
    </div>
  );
}

export function HiddenNoMatches({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-9 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-base">No hidden tracks match “{query}”</h3>
        <p className="max-w-xs text-muted-foreground text-sm">Try a different title or artist.</p>
      </div>
      <Button variant="outline" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}
