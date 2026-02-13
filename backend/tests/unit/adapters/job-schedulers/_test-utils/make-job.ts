import type { Job } from 'bullmq';

export function makeJob<T>(overrides: { name: string; data: T } & Partial<Job<T>> = {} as any): Job<T> {
  const { name, data, ...rest } = overrides;
  return {
    id: 'job-1',
    name: name ?? 'test-job',
    data: data ?? ({} as T),
    timestamp: Date.now(),
    opts: {},
    progress: 0,
    returnvalue: null,
    attemptsMade: 0,
    updateProgress: vi.fn().mockResolvedValue(undefined),
    ...rest,
  } as Job<T>;
}
