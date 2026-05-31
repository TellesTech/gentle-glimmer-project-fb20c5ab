import { useEffect } from 'react';

export function useGlobalErrorHandler() {
  useEffect(() => {
    const logError = async (payload: {
      message: string;
      stack?: string;
      path: string;
      extra?: Record<string, unknown>;
    }) => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !apiKey) return;

        await fetch(`${supabaseUrl}/functions/v1/log-client-error`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey,
          },
          body: JSON.stringify({
            ...payload,
            userId: null,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch {
        // Best effort — never interfere with UX
      }
    };

    const handleError = (event: ErrorEvent) => {
      const msg = event.message || '';
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('Load failed') ||
        msg.includes('Lock') ||
        msg.includes('auth-token')
      ) {
        return;
      }

      logError({
        message: msg || 'Unknown error',
        stack: event.error?.stack,
        path: window.location.pathname,
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const message = error instanceof Error ? error.message : String(error);

      if (
        message.includes('Lock') ||
        message.includes('auth-token') ||
        message.includes('Failed to fetch') ||
        message.includes('NetworkError') ||
        message.includes('Load failed') ||
        message.includes('AbortError') ||
        message.includes('steal')
      ) {
        return;
      }

      logError({
        message: `Unhandled Promise Rejection: ${message}`,
        stack: error instanceof Error ? error.stack : undefined,
        path: window.location.pathname,
        extra: { type: 'unhandledrejection' },
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
}
