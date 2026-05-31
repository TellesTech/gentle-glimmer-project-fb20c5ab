import { useGlobalErrorHandler } from '@/hooks/useGlobalErrorHandler';

export function GlobalErrorListener() {
  useGlobalErrorHandler();
  return null;
}
