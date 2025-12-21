import { ApiError } from './apiClient';

export function parseErrorMessage(err: unknown, fallback = 'Something went wrong') {
  if (err instanceof ApiError) {
    return err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message || fallback;
  }
  return fallback;
}

export function parseFieldErrors(err: unknown): Record<string, string> {
  if (err instanceof ApiError && (err as any).details) {
    const details = (err as any).details;
    if (Array.isArray(details)) {
      return details.reduce((acc: any, item: any) => {
        if (item?.path?.length && item?.message) {
          acc[item.path[0]] = item.message;
        }
        return acc;
      }, {});
    }
  }
  return {};
}

export function handleErrorToast(
  err: unknown,
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void,
  fallback = 'Something went wrong'
) {
  const message = parseErrorMessage(err, fallback);
  showToast(message, 'error');
  return message;
}
