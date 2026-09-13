'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchPublicShareView } from '@/lib/share-api';
import { fetchPublicBranding } from '@/lib/admin-api';
import {
  SHARE_VIEW_KIND_LABELS,
  ShareViewKind,
  ShareViewPublicDto,
  sanitizeShareHtml,
} from '@city-manager/shared';
import { formatDateTime } from '@/lib/format';

export default function PublicShareViewPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(String(params?.token || ''));
  const [data, setData] = useState<ShareViewPublicDto | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [brandTitle, setBrandTitle] = useState('نمای اشتراکی');

  useEffect(() => {
    fetchPublicBranding().then((res) => {
      if (res.success && res.data?.title) setBrandTitle(String(res.data.title));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token) {
      setError('لینک نامعتبر است');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchPublicShareView(token).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.success || !res.data) {
        setError(res.error?.message ?? 'این لینک در دسترس نیست');
        return;
      }
      setData(res.data);
    }).catch(() => {
      if (!cancelled) {
        setLoading(false);
        setError('خطا در بارگذاری لینک');
      }
    });
    return () => { cancelled = true; };
  }, [token]);

  const reportHtml = useMemo(() => {
    const html = data?.snapshot?.report?.html;
    return html ? sanitizeShareHtml(html) : '';
  }, [data]);

  const kindLabel = data
    ? (SHARE_VIEW_KIND_LABELS[data.kind as ShareViewKind] ?? data.kind)
    : '';

  return (
    <div className="share-public-page" dir="rtl">
      <header className="share-public-header">
        <div>
          <p className="share-public-brand">{brandTitle}</p>
          <h1>{data?.title || 'نمای اشتراکی'}</h1>
          {data?.caption ? <p className="share-public-caption">{data.caption}</p> : null}
        </div>
        <div className="share-public-badge" aria-label="فقط خواندنی">
          فقط مشاهده
        </div>
      </header>

      {loading && <p className="share-public-status muted">در حال بارگذاری…</p>}
      {error && !loading && (
        <div className="share-public-error" role="alert">
          <strong>دسترسی ممکن نیست</strong>
          <p>{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          <div className="share-public-meta muted">
            <span>{kindLabel}</span>
            {data.expiresAt ? <span>انقضا: {formatDateTime(data.expiresAt)}</span> : null}
            <span>بازدید: {data.viewCount}</span>
          </div>

          {(data.kind === ShareViewKind.MAP || data.kind === ShareViewKind.HYBRID) && data.snapshot.map && (
            <section className="share-public-card">
              <h2>نمای نقشه</h2>
              {data.snapshot.map.layerLabels?.length ? (
                <ul className="share-public-layers">
                  {data.snapshot.map.layerLabels.map((l) => <li key={l}>{l}</li>)}
                </ul>
              ) : null}
              {data.snapshot.map.note ? <p className="muted">{data.snapshot.map.note}</p> : null}
              {data.snapshot.map.imageDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="share-public-map-image"
                  src={data.snapshot.map.imageDataUrl}
                  alt="نقشه اشتراکی فقط‌خواندنی"
                />
              ) : (
                <p className="muted">تصویر نقشه در این اشتراک ذخیره نشده است؛ فهرست لایه‌ها بالا نمایش داده شد.</p>
              )}
              {data.snapshot.map.bbox ? (
                <p className="share-public-bbox" dir="ltr">
                  BBOX: {data.snapshot.map.bbox.map((n) => Number(n).toFixed(5)).join(', ')}
                </p>
              ) : null}
            </section>
          )}

          {(data.kind === ShareViewKind.REPORT || data.kind === ShareViewKind.HYBRID) && (
            <section className="share-public-card share-public-report">
              <h2>گزارش</h2>
              {reportHtml ? (
                <iframe
                  title="گزارش اشتراکی"
                  className="share-public-report-frame"
                  sandbox=""
                  srcDoc={reportHtml}
                />
              ) : (
                <p className="muted">محتوای گزارش در این لینک موجود نیست.</p>
              )}
            </section>
          )}

          <footer className="share-public-footer muted">
            این صفحه فقط‌خواندنی است و امکان ویرایش یا تغییر داده وجود ندارد.
            {data.snapshot.producer ? ` · تهیه‌کننده: ${data.snapshot.producer}` : ''}
          </footer>
        </>
      )}
    </div>
  );
}
