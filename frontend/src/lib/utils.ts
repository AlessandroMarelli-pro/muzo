import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  let duration = '';
  if (hours > 0) {
    duration += `${hours}h `;
  }
  if (minutes > 0) {
    duration += `${minutes}m `;
  }
  if (remainingSeconds > 0) {
    duration += `${remainingSeconds}s`;
  }
  return duration;
};

export const formatSimilarity = (similarity: number) => {
  return `${Math.round(similarity)}%`;
};

export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
