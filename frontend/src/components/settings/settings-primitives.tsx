import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Check, Copy, Loader2 } from 'lucide-react';
import * as React from 'react';

/**
 * Shared building blocks for the Settings surface.
 *
 * The Settings pages are a two-pane shell: a sub-nav on the sidebar stock, a
 * content pane on the page stock. Inside the pane, structure comes from tonal
 * steps and generous spacing — not hairline dividers (the Ghost Border Rule) —
 * so these primitives lean on `bg-card` / spacing rather than `border-t`.
 */

/** A titled block within a section. The heading gets more space above than below it. */
export function SettingsBlock({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold leading-none">{title}</h2>
          {description ? (
            <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * The card used inside the content pane. One tonal step off the stock, generous
 * rounding, the resting ambient lift — a physical object on the page, per the
 * design system's "never a hard-edged panel".
 */
export function SettingsCard({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-xl bg-card p-5 shadow-sm sm:p-6', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * A secret input with the "leave blank to keep current" contract. An empty field
 * on save means "don't change the stored value"; the bullet placeholder plus the
 * "Saved" hint make the stored-but-hidden state legible.
 */
export function SecretField({
  id,
  label,
  hint,
  stored,
  value,
  onChange,
  plainText = false,
  disabled,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  stored: boolean | undefined;
  value: string;
  onChange: (v: string) => void;
  /** Client IDs and other non-secret values render as plain text. */
  plainText?: boolean;
  disabled?: boolean;
}) {
  const untouchedStored = stored && !value;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {stored ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              value ? 'text-warning' : 'text-success',
            )}
          >
            <Check className="size-3" aria-hidden />
            {value ? 'Will replace saved value' : 'Saved'}
          </span>
        ) : null}
      </div>
      <Input
        id={id}
        type={plainText ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        placeholder={untouchedStored ? '••••••••••••••••' : plainText ? '' : 'Paste your key'}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The save button for a section — filled spot-blue when the section has unsaved edits, ghost when clean. */
export function SaveButton({
  dirty,
  saving,
  disabled,
  onClick,
  children = 'Save changes',
  idleLabel = 'Saved',
}: {
  dirty: boolean;
  saving: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
  idleLabel?: string;
}) {
  return (
    <Button
      size="sm"
      variant={dirty ? 'default' : 'outline'}
      disabled={saving || disabled || !dirty}
      onClick={onClick}
    >
      {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      {dirty ? children : idleLabel}
    </Button>
  );
}

/** Read-only value with a copy affordance — for the OAuth callback URI users transcribe into consoles. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the value is still selectable */
    }
  }, [value]);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-stretch gap-2">
        <code className="flex min-w-0 flex-1 items-center overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={copy}
          aria-label={copied ? 'Copied' : `Copy ${label}`}
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
