import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDuration = (seconds: number, withAllTime = false) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  let duration = '';
  if (hours > 0 || withAllTime) {
    duration += `${hours}h `;
  }
  if (minutes > 0 || withAllTime) {
    duration += `${minutes}m `;
  }
  if (remainingSeconds > 0 || withAllTime) {
    duration += `${remainingSeconds}s`;
  }
  return duration;
};

/**
 * `similarity` is the raw Elasticsearch recommendation score: an embedding
 * cosine base in [0,1] plus bounded criteria boosts, so the practical range
 * is roughly [0, 1.7] rather than a percentage. Clamped so a boosted score
 * above 1.0 still reads as "100%" instead of overflowing.
 */
export const formatSimilarity = (similarity: number) => {
  const percent = Math.max(0, Math.min(1, similarity)) * 100;
  return `${Math.round(percent)}%`;
};

export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const capitalizeEveryWord = (string: string) => {
  return string
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const encodeBase64 = (value: string) => {
  return btoa(value);
};
