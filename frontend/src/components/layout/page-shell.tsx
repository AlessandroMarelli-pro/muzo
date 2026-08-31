import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * The canonical page container. Every route body should be wrapped in this so
 * padding and vertical rhythm stay consistent instead of each page hand-rolling
 * its own `p-6` / `p-4 lg:p-6` / `px-6`.
 */
function PageShell({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex w-full flex-col gap-6 p-4 lg:p-6', className)} {...props}>
      {children}
    </div>
  );
}

interface PageHeaderProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  title: string;
  description?: string;
  /** Right-aligned actions (filter buttons, create buttons, search, ...). */
  children?: React.ReactNode;
}

/**
 * Page description plus a right-aligned actions slot.
 *
 * The visible page name lives in the site header, so the `<h1>` here is
 * screen-reader only — it keeps a real document outline without showing the
 * title twice.
 */
function PageHeader({ title, description, children, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-4 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
      {...props}
    >
      <div className="space-y-1">
        <h1 className="sr-only">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * Optional body wrapper for pages whose content must fill the remaining height
 * (e.g. a split view with a sticky side panel).
 */
function PageContent({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)} {...props}>
      {children}
    </div>
  );
}

export { PageContent, PageHeader, PageShell };
