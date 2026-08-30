import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface ProviderAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerLabel: string;
  authUrl: string | null;
  isLoadingUrl: boolean;
  code: string;
  onCodeChange: (v: string) => void;
  onComplete: () => void;
  isCompleting: boolean;
  /** PKCE providers (TIDAL) need a verifier present; gate the submit button. */
  canComplete?: boolean;
}

export function ProviderAuthDialog({
  open,
  onOpenChange,
  providerLabel,
  authUrl,
  isLoadingUrl,
  code,
  onCodeChange,
  onComplete,
  isCompleting,
  canComplete = true,
}: ProviderAuthDialogProps) {
  const openAuthUrl = () => {
    if (!authUrl) return;
    const newWindow = window.open(authUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow || newWindow.closed) {
      alert('Popup blocked. Please click the link below to open the authorization page.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Authenticate with {providerLabel}</DialogTitle>
          <DialogDescription>
            Connect your {providerLabel} account by authorizing access below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              1. Click the button below to open the {providerLabel} authorization page
            </p>
            {isLoadingUrl ? (
              <Button disabled className="w-full" variant="outline">
                Loading authorization URL…
              </Button>
            ) : authUrl ? (
              <>
                <Button onClick={openAuthUrl} className="w-full" variant="outline">
                  Open {providerLabel} Authorization
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Or{' '}
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(authUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    click here to open in a new tab
                  </a>
                </p>
              </>
            ) : (
              <Button disabled className="w-full" variant="outline">
                No URL available
              </Button>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              2. After authorizing, copy the{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">code</code> parameter from the
              redirect URL and paste it below
            </p>
            <Input
              placeholder="Enter authorization code"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              disabled={isCompleting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onComplete}
            disabled={!code.trim() || isCompleting || !canComplete}
          >
            {isCompleting ? 'Authenticating…' : 'Complete Authentication'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
