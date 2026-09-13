export type ApiErrorPayload = {
  code: string;
  message: string;
  retryAfterSec?: number;
  contactAdmin?: boolean;
};

function extraErrorFields(src?: {
  retryAfterSec?: unknown;
  contactAdmin?: unknown;
}): Pick<ApiErrorPayload, 'retryAfterSec' | 'contactAdmin'> {
  const extra: Pick<ApiErrorPayload, 'retryAfterSec' | 'contactAdmin'> = {};
  if (typeof src?.retryAfterSec === 'number' && Number.isFinite(src.retryAfterSec)) {
    extra.retryAfterSec = Math.max(0, Math.floor(src.retryAfterSec));
  }
  if (typeof src?.contactAdmin === 'boolean') extra.contactAdmin = src.contactAdmin;
  return extra;
}

/** Normalize our `{ success }` envelope and Nest default error bodies. */

export function parseApiResult<T>(
  json: unknown,
  httpOk: boolean,
): { success: boolean; data?: T; meta?: { page?: number; limit?: number; total?: number }; error?: ApiErrorPayload } {
  if (json && typeof json === 'object' && 'success' in json && typeof (json as { success: unknown }).success === 'boolean') {
    const o = json as {
      success: boolean;
      data?: T;
      meta?: { page?: number; limit?: number; total?: number };
      error?: { code?: string; message?: string; retryAfterSec?: number; contactAdmin?: boolean };
    };
    if (o.success) return { success: true, data: o.data, ...(o.meta ? { meta: o.meta } : {}) };
    return {
      success: false,
      error: {
        code: o.error?.code ?? 'ERROR',
        message: o.error?.message ?? 'عملیات ناموفق بود',
        ...extraErrorFields(o.error),
      },
    };
  }

  const o = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const raw = o.message;
  const message = Array.isArray(raw)
    ? raw.map(String).join(', ')
    : typeof raw === 'string' && raw.trim()
      ? raw
      : httpOk
        ? 'پاسخ نامعتبر از سرور'
        : Object.keys(o).length === 0
          ? 'ارتباط با سرور برقرار نشد. چند ثانیه صبر کنید و دوباره وارد شوید.'
          : 'عملیات ناموفق بود';

  return {
    success: false,
    error: {
      code: String(o.statusCode ?? o.error ?? (httpOk ? 'INVALID_RESPONSE' : 'HTTP_ERROR')),
      message,
      ...extraErrorFields(o),
    },
  };
}
