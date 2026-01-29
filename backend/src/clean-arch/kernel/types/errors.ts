export type NotFoundError = {
  errorType: 'NotFoundError';
  message: string;
};
export const createNotFoundError = (message: string): NotFoundError => ({
  errorType: 'NotFoundError',
  message,
});
