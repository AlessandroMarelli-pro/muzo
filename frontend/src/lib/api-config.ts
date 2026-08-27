/** Base URL of the backend API. Empty string means same-origin (e.g. behind a reverse proxy). */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
