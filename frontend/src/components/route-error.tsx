import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, RotateCw } from 'lucide-react';

interface RouteErrorProps {
  /** Short, plain-language explanation of what went wrong. */
  title?: string;
  message?: string;
  /** The underlying error — logged to the console only, never rendered. */
  error?: unknown;
  /** Where "Go back" should land. Defaults to the app home. */
  backTo?: string;
  backLabel?: string;
}

/**
 * The app-wide fallback for route loader/render failures. It deliberately does
 * NOT surface `error.message` or any response body — those leak API internals
 * and read as a crash to a non-technical user. The raw error goes to the
 * console for debugging.
 */
export function RouteError({
  title = 'Something went wrong',
  message = 'We hit a problem loading this page. Try again in a moment.',
  error,
  backTo = '/',
  backLabel = 'Go home',
}: RouteErrorProps) {
  const router = useRouter();

  if (error && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('[route error]', error);
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => router.invalidate()}>
          <RotateCw className="h-4 w-4" aria-hidden />
          Try again
        </Button>
        <Button asChild size="sm">
          <Link to={backTo}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Not-found variant: no "try again", just a way back. */
export function RouteNotFound({
  title = 'Not found',
  message = "We couldn't find what you were looking for. It may have been moved or deleted.",
  backTo = '/',
  backLabel = 'Go home',
}: Pick<RouteErrorProps, 'title' | 'message' | 'backTo' | 'backLabel'>) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      <Button asChild size="sm">
        <Link to={backTo}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
      </Button>
    </div>
  );
}
