export function normalizeForMatch(value: string | undefined | null): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, '');
}
