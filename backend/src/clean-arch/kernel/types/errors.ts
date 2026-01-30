export type NotFoundError = {
  errorType: 'NotFoundError';
  message: string;
};
export const createNotFoundError = (message: string): NotFoundError => ({
  errorType: 'NotFoundError',
  message,
});

export type DomainError = NotFoundError;

export const isDomainError = (x: unknown): x is DomainError =>
  typeof x === 'object' && x !== null && 'errorType' in x && !('error' in x);
