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
    || lower.includes('chunkloaderror')
    || lower.includes('loading chunk')
  ) {
    return 'نسخهٔ صفحه با برنامه هم‌خوان نیست. یک‌بار رفرش کامل کنید (Ctrl+F5).';
  }

  if (
    lower.includes('failed to fetch')
    || lower.includes('network')
    || lower.includes('load failed')
    || lower.includes('timeout')
  ) {
    return 'ارتباط با سرور برقرار نشد. اتصال را بررسی کنید و دوباره تلاش کنید.';
  }

  if (!raw.trim() || raw.length > 180 || /[_$]|WEBPACK|TypeError|ReferenceError|SyntaxError/i.test(raw)) {
    return 'مشکلی در بارگذاری پیش آمد. دوباره تلاش کنید.';
  }

  return raw;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="dashboard-error card" style={{ margin: '2rem auto', maxWidth: 480 }}>
      <h2>خطا</h2>
      <p className="muted">{friendlyErrorMessage(error)}</p>
      <div className="dashboard-error-actions">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          تلاش مجدد
        </button>
        <Link href="/" className="btn">
          صفحه اصلی
        </Link>
      </div>
    </div>
  );
}
