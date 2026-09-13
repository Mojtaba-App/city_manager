'use client';

import Link from 'next/link';

function friendlyErrorMessage(error: Error & { digest?: string }): string {
  const raw = String(error?.message || '');
  const lower = raw.toLowerCase();

  if (
    lower.includes('is not a function')
    || lower.includes('is not defined')
    || lower.includes('cannot read propert')
    || lower.includes('webpack')
    || lower.includes('module')
    || lower.includes('chunkloaderror')
    || lower.includes('loading chunk')
  ) {
    return 'نسخهٔ صفحه با برنامه هم‌خوان نیست. یک‌بار رفرش کامل کنید (Ctrl+F5) یا از داشبورد دوباره وارد شوید.';
  }

  if (
    lower.includes('failed to fetch')
    || lower.includes('network')
    || lower.includes('load failed')
    || lower.includes('timeout')
  ) {
    return 'ارتباط با سرور برقرار نشد. اتصال اینترنت و وضعیت سرویس را بررسی کنید، سپس دوباره تلاش کنید.';
  }

  if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('403')) {
    return 'دسترسی شما برای این بخش کافی نیست یا نشست منقضی شده. دوباره وارد شوید.';
  }

  // Hide opaque technical dumps; keep short actionable Persian text.
  if (!raw.trim() || raw.length > 180 || /[_$]|WEBPACK|TypeError|ReferenceError|SyntaxError/i.test(raw)) {
    return 'مشکلی در بارگذاری این بخش پیش آمد. دوباره تلاش کنید؛ اگر تکرار شد صفحه را رفرش کنید.';
  }

  return raw;
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = friendlyErrorMessage(error);

  return (
    <div className="dashboard-error card">
      <h2>خطا در بارگذاری صفحه</h2>
      <p className="muted">{message}</p>
      {error.digest ? (
        <p className="muted" style={{ fontSize: '0.75rem' }} dir="ltr">
          کد پیگیری: {error.digest}
        </p>
      ) : null}
      <div className="dashboard-error-actions">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          تلاش مجدد
        </button>
        <Link href="/dashboard" className="btn">
          بازگشت به داشبورد
        </Link>
      </div>
    </div>
  );
}
