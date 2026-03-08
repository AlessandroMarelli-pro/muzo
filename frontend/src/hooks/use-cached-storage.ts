import { useRef } from 'react';

/**
 * Returns a cached value from sessionStorage for the given key.
 * Reads once per component mount and returns the same value on subsequent renders
 * (avoids repeated storage access). Use for values that don't change during the
 * component's lifetime or when a fresh read on every render isn't needed.
 */
export function useCachedSessionStorage(key: string): string | null {
  const ref = useRef<string | null | undefined>(undefined);
  if (ref.current === undefined) {
    try {
      ref.current = sessionStorage.getItem(key);
    } catch {
      ref.current = null;
    }
  }
  return ref.current;
}

/**
 * Returns a cached value from localStorage for the given key.
 * Reads once per component mount. Use for initial/default values (e.g. sidebar state).
 */
export function useCachedLocalStorage(key: string): string | null {
  const ref = useRef<string | null | undefined>(undefined);
  if (ref.current === undefined) {
    try {
      ref.current = localStorage.getItem(key);
    } catch {
      ref.current = null;
    }
  }
  return ref.current;
}
