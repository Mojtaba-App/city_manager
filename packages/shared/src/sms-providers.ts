import { toLatinDigits } from './persian-digits';

export const SMS_IR_DEFAULT_BASE = 'https://api.sms.ir/v1';

export const SMS_PROVIDER_OPTIONS = [
  { value: 'kavenegar', label: 'کاوه نگار', defaultBaseUrl: 'https://api.kavenegar.com/v1' },
  { value: 'melipayamak', label: 'ملی‌پیامک', defaultBaseUrl: 'https://rest.payamak-panel.com' },
  { value: 'smsir', label: 'sms.ir', defaultBaseUrl: SMS_IR_DEFAULT_BASE },
  { value: 'custom', label: 'سرویس سفارشی (API)', defaultBaseUrl: '' },
] as const;

export type SmsProviderId = (typeof SMS_PROVIDER_OPTIONS)[number]['value'];

export function isSmsIrProvider(provider?: string, apiBaseUrl?: string): boolean {
  const p = String(provider ?? '').toLowerCase().replace(/[._\s-]/g, '');
  if (p === 'smsir' || p === 'smsirir') return true;
  return /sms\.ir/i.test(String(apiBaseUrl ?? ''));
}

export function smsProviderDefaultBase(provider?: string): string {
  const row = SMS_PROVIDER_OPTIONS.find((p) => p.value === provider);
  return row?.defaultBaseUrl ?? '';
}

/** Normalize Iranian mobile to `09xxxxxxxxx` (11 digits). */
export function normalizeIranMobile(raw: string): string {
  const digits = toLatinDigits(String(raw ?? '')).replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length >= 12) return `0${digits.slice(2, 12)}`;
  if (digits.startsWith('9') && digits.length === 10) return `0${digits}`;
  if (digits.length > 11) return digits.slice(-11);
  return digits;
}

/** True when normalized form is a valid Iranian mobile (09 + 9 digits). */
export function isIranMobile(raw: string): boolean {
  return /^09\d{9}$/.test(normalizeIranMobile(raw));
}

/** Common storage variants for DB lookup (OR match). */
export function iranMobileLookupVariants(raw: string): string[] {
  const n = normalizeIranMobile(raw);
  if (!/^09\d{9}$/.test(n)) return [];
  const national = n.slice(1); // 9xxxxxxxxx
  return Array.from(new Set([
    n,
    national,
    `+98${national}`,
    `98${national}`,
    `0${national}`,
  ]));
}

function trimBase(url: string | undefined, fallback = ''): string {
  const base = String(url || fallback).trim().replace(/\/+$/, '');
  return base;
}

export function buildSmsIrCreditUrl(apiBaseUrl?: string): string {
  return `${trimBase(apiBaseUrl, SMS_IR_DEFAULT_BASE)}/credit`;
}

export function buildSmsIrBulkUrl(apiBaseUrl?: string): string {
  return `${trimBase(apiBaseUrl, SMS_IR_DEFAULT_BASE)}/send/bulk`;
}

export function smsIrAuthHeaders(apiKey: string, jsonBody = true): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-api-key': apiKey,
  };
  if (jsonBody) headers['Content-Type'] = 'application/json';
  return headers;
}

export function buildSmsIrBulkBody(sender: string, recipient: string, message: string): Record<string, unknown> {
  const line = Number(String(sender).replace(/\s/g, ''));
  return {
    lineNumber: Number.isFinite(line) && String(sender).trim() !== '' ? line : sender,
    messageText: message,
    mobiles: [normalizeIranMobile(recipient)],
  };
}

export function parseSmsIrApiResult(
  json: unknown,
  httpOk: boolean,
): { ok: boolean; message: string; credit?: number } {
  const o = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const status = o.status;
  const ok = httpOk && (status === 1 || status === '1');
  const credit = typeof o.data === 'number' ? o.data : undefined;
  const rawMsg = typeof o.message === 'string' ? o.message.trim() : '';
  if (ok) {
    return {
      ok: true,
      credit,
      message: credit != null
        ? `اتصال sms.ir برقرار شد. اعتبار: ${credit}`
        : (rawMsg || 'اتصال sms.ir برقرار شد'),
    };
  }
  const httpHint = httpOk ? '' : 'پاسخ HTTP ناموفق. ';
  return {
    ok: false,
    message: `${httpHint}${rawMsg || 'ارسال از sms.ir ناموفق بود'}`.trim(),
  };
}

export function buildSmsConnectionProbe(cfg: {
  provider?: string;
  apiBaseUrl?: string;
  apiKey?: string;
}): { url: string; method: 'GET'; headers: Record<string, string> } {
  const base = String(cfg.apiBaseUrl ?? '').trim();
  if (isSmsIrProvider(cfg.provider, base)) {
    return {
      url: buildSmsIrCreditUrl(base),
      method: 'GET',
      headers: smsIrAuthHeaders(String(cfg.apiKey ?? ''), false),
    };
  }
  return {
    url: base,
    method: 'GET',
    headers: { Accept: 'application/json' },
  };
}
