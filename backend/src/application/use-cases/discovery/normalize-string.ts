export function normalizeForMatch(value: string | undefined | null): string {
  return (value ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}
