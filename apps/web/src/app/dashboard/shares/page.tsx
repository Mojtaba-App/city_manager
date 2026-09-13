'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { EmptyState, PageHeader, PermissionGate } from '@/components/admin/AdminUi';
import { useFeedback } from '@/components/ui/Feedback';
import { useDashboardAccess } from '@/lib/use-dashboard-access';
import {
  absoluteShareUrl,
  createShareView,
  fetchShareViews,
  revokeShareView,
} from '@/lib/share-api';
import {
  SHARE_REPORT_SECTION_LABELS,
  SHARE_REPORT_SECTIONS,
  SHARE_VIEW_KIND_LABELS,
  SHARE_VIEW_STATUS_LABELS,
  ShareReportSection,
  ShareViewKind,
  ShareViewListItem,
  ShareViewStatus,
  buildShareViewPath,
} from '@city-manager/shared';
import { formatDateTime, formatNumber } from '@/lib/format';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

export default function ShareViewsPage() {
  const feedback = useFeedback();
  const { canView: canRead, canWrite: canManage } = useDashboardAccess('/dashboard/shares');
  const [items, setItems] = useState<ShareViewListItem[]>([]);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    kind: ShareViewKind.REPORT as string,
    title: '',
    caption: '',
    recipientLabel: '',
    expiresInDays: '7',
    sections: ['kpis', 'map_inset'] as string[],
    reportHtml: '',
    layerLabels: '',
    mapNote: '',
  });
  const { loading, error, setError, run } = useQueryLoad();

  async function load() {
    await run(async () => {
      const res = await fetchShareViews();
      if (res.success && res.data) setItems(res.data);
      else if (!res.success) setError(res.error?.message ?? 'بارگذاری اشتراک‌ها ناموفق بود');
    });
  }

  useEffect(() => {
    if (canRead) void load();
  }, [canRead]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    if (!form.title.trim()) {
      feedback.error('عنوان الزامی است');
      return;
    }
    setBusy(true);
    setCreatedLink(null);
    try {
      const layerLabels = form.layerLabels.split(/[\n,،]+/).map((s) => s.trim()).filter(Boolean);
      const snapshot = {
        kind: form.kind,
        title: form.title.trim(),
        caption: form.caption.trim() || undefined,
        generatedAt: new Date().toISOString(),
        report: (form.kind === ShareViewKind.REPORT || form.kind === ShareViewKind.HYBRID)
          ? {
              sections: form.sections,
              html: form.reportHtml.trim()
                || `<html lang="fa" dir="rtl"><body><h1>${form.title}</h1><p>${form.caption || 'گزارش اشتراکی فقط‌خواندنی'}</p><ul>${form.sections.map((s) => `<li>${SHARE_REPORT_SECTION_LABELS[s as ShareReportSection] ?? s}</li>`).join('')}</ul></body></html>`,
              title: form.title.trim(),
            }
          : undefined,
        map: (form.kind === ShareViewKind.MAP || form.kind === ShareViewKind.HYBRID)
          ? {
              layerLabels: layerLabels.length ? layerLabels : ['لایه انتخاب‌شده'],
              note: form.mapNote.trim() || undefined,
            }
          : undefined,
      };
      const res = await createShareView({
        kind: form.kind,
        title: form.title.trim(),
        caption: form.caption.trim() || undefined,
        recipientLabel: form.recipientLabel.trim() || undefined,
        expiresInDays: Number(form.expiresInDays) || 7,
        reportSections: form.sections,
        snapshot,
      });
      if (!res.success || !res.data) {
        feedback.error(res.error?.message ?? 'ایجاد لینک ناموفق');
        return;
      }
      const url = absoluteShareUrl(res.data.publicPath || buildShareViewPath(res.data.token));
      setCreatedLink(url);
      feedback.success('لینک فقط‌خواندنی ساخته شد');
      setForm({
        kind: ShareViewKind.REPORT,
        title: '',
        caption: '',
        recipientLabel: '',
        expiresInDays: '7',
        sections: ['kpis', 'map_inset'],
        reportHtml: '',
        layerLabels: '',
        mapNote: '',
      });
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      feedback.success('لینک کپی شد');
    } catch {
      await feedback.alert(url, 'لینک اشتراک');
    }
  }

  return (
    <AppShell title="اشتراک لینک">
      <PermissionGate allow={canRead}>
        <PageHeader
          title="لینک‌های فقط‌خواندنی"
          description="اشتراک پویا از گزارش یا لایه نقشه برای مخاطب — بدون امکان ویرایش"
        />

        <section className="card share-intro">
          <p className="muted" style={{ margin: 0 }}>
            لینک عمومی: <code className="int-ltr-code" dir="ltr">/share/&lt;token&gt;</code>
            {' '}— مخاطب فقط محتوای ارسال‌شده را در مرورگر می‌بیند.
          </p>
        </section>

        {createdLink && (
          <section className="card share-created-banner">
            <strong>لینک آماده ارسال</strong>
            <div className="int-ltr-link">
              <a className="int-ltr-link-text" href={createdLink} target="_blank" rel="noreferrer" dir="ltr">
                {createdLink}
              </a>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => void copyLink(createdLink)}>کپی</button>
            </div>
            <p className="muted" style={{ margin: '0.5rem 0 0' }}>این توکن فقط یک‌بار در این پیام کامل نمایش داده می‌شود.</p>
          </section>
        )}

        <div className={`referrals-workspace ${canManage ? '' : 'referrals-workspace--single'}`}>
          {canManage && (
            <section className="card">
              <h3>ایجاد اشتراک جدید</h3>
              <form className="sec-form-rows" onSubmit={(e) => void handleCreate(e)}>
                <label className="settings-field sec-form-row">
                  <span className="settings-field-label">نوع *</span>
                  <select
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  >
                    {Object.values(ShareViewKind).map((k) => (
                      <option key={k} value={k}>{SHARE_VIEW_KIND_LABELS[k]}</option>
                    ))}
                  </select>
                </label>
                <label className="settings-field sec-form-row">
                  <span className="settings-field-label">عنوان *</span>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </label>
                <label className="settings-field sec-form-row">
                  <span className="settings-field-label">توضیح برای مخاطب</span>
                  <textarea rows={2} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
                </label>
                <label className="settings-field sec-form-row">
                  <span className="settings-field-label">مخاطب (اختیاری)</span>
                  <input value={form.recipientLabel} onChange={(e) => setForm({ ...form, recipientLabel: e.target.value })} placeholder="مدیر منطقه ۳" />
                </label>
                <label className="settings-field sec-form-row">
                  <span className="settings-field-label">انقضا (روز)</span>
                  <input type="number" min={1} max={90} value={form.expiresInDays} onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })} />
                </label>

                {(form.kind === ShareViewKind.REPORT || form.kind === ShareViewKind.HYBRID) && (
                  <div className="referrals-scope-panel">
                    <h4 className="referrals-subtitle">بخش‌های گزارش</h4>
                    <div className="referrals-scope-grid">
                      {SHARE_REPORT_SECTIONS.map((s) => (
                        <label key={s} className="referrals-scope-option">
                          <input
                            type="checkbox"
                            checked={form.sections.includes(s)}
                            onChange={(e) => setForm({
                              ...form,
                              sections: e.target.checked
                                ? [...form.sections, s]
                                : form.sections.filter((x) => x !== s),
                            })}
                          />
                          <span>{SHARE_REPORT_SECTION_LABELS[s]}</span>
                        </label>
                      ))}
                    </div>
                    <label className="settings-field sec-form-row" style={{ marginTop: '0.75rem' }}>
                      <span className="settings-field-label">HTML گزارش (اختیاری)</span>
                      <textarea
                        rows={4}
                        className="int-mapping-editor"
                        dir="ltr"
                        placeholder="در صورت خالی بودن، خلاصه بخش‌ها ساخته می‌شود — از صفحه تحلیل می‌توانید گزارش کامل بسازید"
                        value={form.reportHtml}
                        onChange={(e) => setForm({ ...form, reportHtml: e.target.value })}
                      />
                    </label>
                  </div>
                )}

                {(form.kind === ShareViewKind.MAP || form.kind === ShareViewKind.HYBRID) && (
                  <>
                    <label className="settings-field sec-form-row">
                      <span className="settings-field-label">نام لایه‌ها</span>
                      <textarea
                        rows={2}
                        placeholder="هر لایه در یک خط یا با ویرگول"
                        value={form.layerLabels}
                        onChange={(e) => setForm({ ...form, layerLabels: e.target.value })}
                      />
                    </label>
                    <label className="settings-field sec-form-row">
                      <span className="settings-field-label">یادداشت نقشه</span>
                      <input value={form.mapNote} onChange={(e) => setForm({ ...form, mapNote: e.target.value })} />
                    </label>
                  </>
                )}

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? 'در حال ساخت…' : 'ساخت لینک فقط‌خواندنی'}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="card">
            <h3>اشتراک‌های اخیر</h3>
            <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={4} />} loadingLabel="بارگذاری…">
              {items.length === 0 ? (
                <EmptyState title="هنوز لینکی ساخته نشده" description="یک گزارش یا لایه را به‌صورت لینک موقت برای مخاطب بفرستید." />
              ) : (
                <ul className="share-list">
                  {items.map((item) => (
                    <li key={item.id} className="share-list-item">
                      <div>
                        <div className="share-list-head">
                          <strong>{item.title}</strong>
                          <span className={`status-pill ${item.status === ShareViewStatus.ACTIVE ? 'ok' : 'off'}`}>
                            {SHARE_VIEW_STATUS_LABELS[item.status as ShareViewStatus] ?? item.status}
                          </span>
                        </div>
                        <small className="muted">
                          {SHARE_VIEW_KIND_LABELS[item.kind as ShareViewKind] ?? item.kind}
                          {' · '}
                          {formatDateTime(item.createdAt)}
                          {item.expiresAt ? ` · تا ${formatDateTime(item.expiresAt)}` : ''}
                          {' · '}
                          بازدید {formatNumber(item.viewCount)}
                          {' · '}
                          <span dir="ltr">…{item.tokenHint}</span>
                        </small>
                      </div>
                      {canManage && item.status === ShareViewStatus.ACTIVE && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={async () => {
                            const ok = await feedback.confirm('این لینک لغو شود؟', 'لغو اشتراک');
                            if (!ok) return;
                            const res = await revokeShareView(item.id);
                            if (res.success) {
                              feedback.success('لینک لغو شد');
                              void load();
                            } else {
                              feedback.error(res.error?.message ?? 'لغو ناموفق');
                            }
                          }}
                        >
                          لغو
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
          </section>
        </div>
      </PermissionGate>
    </AppShell>
  );
}
