export async function getEdgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as { error?: unknown };
        if (typeof body.error === 'string' && body.error.trim()) return body.error;
      } catch {
        // Keep the fallback when the response is not JSON.
      }
    }
  }
  if (error instanceof Error && error.message && !error.message.includes('non-2xx')) return error.message;
  return fallback;
}