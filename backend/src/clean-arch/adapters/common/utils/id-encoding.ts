export function toBase64Id(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url'); // or 'base64' if you prefer
}

export function fromBase64Id(encoded: string): string {
  return Buffer.from(encoded, 'base64url').toString('utf8'); // same as above
}
