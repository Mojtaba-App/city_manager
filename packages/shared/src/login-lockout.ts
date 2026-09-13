export const LOGIN_FAIL_LIMIT = 3;
export const LOGIN_LOCK_MS = 3 * 60_000;
export const LOGIN_OTP_RESEND_MS = 2 * 60_000;
export const LOGIN_OTP_TTL_MS = 5 * 60_000;

export const LOGIN_CONTACT_ADMIN_MESSAGE = 'ورود موقتاً مسدود است. با مدیر سیستم تماس بگیرید.';

export function formatCountdownMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function loginLockMessage(retryAfterSec: number, contactAdmin: boolean): string {
  if (contactAdmin) return LOGIN_CONTACT_ADMIN_MESSAGE;
  return `ورود پس از ۳ تلاش ناموفق به‌مدت ۳ دقیقه مسدود شد. ${formatCountdownMmSs(retryAfterSec)} تا رفع مسدودی.`;
}

export function otpResendWaitMessage(retryAfterSec: number): string {
  return `ارسال مجدد تا ${formatCountdownMmSs(retryAfterSec)} دیگر ممکن نیست.`;
}
