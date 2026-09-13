/** Persian (fa-IR) display helpers — digits ۰-۹, Jalali calendar via locale */

const FA = 'fa-IR';
const FA_NUM: Intl.NumberFormatOptions = { numberingSystem: 'arabext' };

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** تاریخ کامل با ساعت — مثلاً ۱۴۰۴/۵/۲۲، ۲۲:۳۰:۱۵ */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  fallback = '—',
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleString(FA, {
    numberingSystem: 'arabext',
    calendar: 'persian',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** فقط تاریخ */
export function formatDate(
  value: string | number | Date | null | undefined,
  fallback = '—',
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(FA, {
    numberingSystem: 'arabext',
    calendar: 'persian',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** فقط ساعت */
export function formatTime(
  value: string | number | Date | null | undefined,
  fallback = '—',
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleTimeString(FA, {
    numberingSystem: 'arabext',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** عدد با ارقام فارسی */
export function formatNumber(
  value: string | number | null | undefined,
  options?: Intl.NumberFormatOptions,
  fallback = '—',
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return fallback;
  return n.toLocaleString(FA, { ...FA_NUM, ...options });
}

/** درصد */
export function formatPercent(
  value: string | number | null | undefined,
  digits = 0,
  fallback = '—',
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return fallback;
  return n.toLocaleString(FA, {
    ...FA_NUM,
    style: 'percent',
    maximumFractionDigits: digits,
  });
}

/** مبلغ / عدد با واحد اختیاری */
export function formatMetric(
  value: string | number | null | undefined,
  unit?: string,
  fallback = '—',
): string {
  const num = formatNumber(value, undefined, fallback);
  if (num === fallback) return fallback;
  return unit ? `${num} ${unit}` : num;
}

/** ارقام لاتین داخل متن را به فارسی تبدیل می‌کند (برای رشته‌های ترکیبی) */
export { toPersianDigits, toLatinDigits, normalizeDigitsForSearch } from '@city-manager/shared';
