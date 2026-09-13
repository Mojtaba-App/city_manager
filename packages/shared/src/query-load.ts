const DEFAULT_QUERY_ERROR = 'بارگذاری ناموفق بود';

export function toQueryError(err: unknown, fallback = DEFAULT_QUERY_ERROR): string {
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return fallback;
}

export function firstQueryFailure(
  results: Array<{ success?: boolean; error?: { message?: string } | null }>,
  fallback = DEFAULT_QUERY_ERROR,
): string | null {
  const failed = results.filter((r) => r && r.success === false);
  if (failed.length === 0 || failed.length < results.length) return null;
  return failed[0]?.error?.message?.trim() || fallback;
}
