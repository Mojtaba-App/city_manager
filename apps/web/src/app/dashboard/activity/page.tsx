'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader, PermissionGate, EmptyState } from '@/components/admin/AdminUi';
import { NavIcon } from '@/components/NavIcons';
import { OsLogo, detectOs, OS_LABELS } from '@/components/ui/OsLogo';
import { useAuth } from '@/lib/auth';
import { fetchSecurityAudit } from '@/lib/security-api';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { AuditLogDto } from '@city-manager/shared';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

const OUTCOME_LABEL: Record<string, string> = {
  success: 'موفق',
  failure: 'ناموفق',
  denied: 'رد شده',
};

function isLightOn(outcome?: string) {
  return outcome === 'success' || !outcome;
}

export default function ActivityPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<AuditLogDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [outcome, setOutcome] = useState('');
  const [selected, setSelected] = useState<AuditLogDto | null>(null);
  const limit = 15;
  const { loading, error, setError, run } = useQueryLoad();

  useEffect(() => {
    if (!hasPermission('audit:read')) return;
    void run(async () => {
      const r = await fetchSecurityAudit({ page, limit, outcome, q });
      if (r.success && r.data) {
        setItems(r.data.items);
        setTotal(r.data.total);
      } else if (!r.success) {
        setError(r.error?.message ?? 'بارگذاری فعالیت‌ها ناموفق بود');
      }
    });
  }, [hasPermission, page, outcome, q, run, setError]);

  return (
    <AppShell title="فعالیت‌های اخیر">
      <PermissionGate allow={hasPermission('audit:read')}>
        <PageHeader
          title="فعالیت‌های اخیر"
          description="خلاصه رویدادهای مهم سامانه — آی‌پی، سیستم‌عامل و وضعیت"
        />

        <div className="activity-compact-toolbar">
          <input
            placeholder="جستجو…"
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
          />
          <select value={outcome} onChange={(e) => { setPage(1); setOutcome(e.target.value); }}>
            <option value="">همه</option>
            <option value="success">موفق</option>
            <option value="failure">ناموفق</option>
            <option value="denied">رد شده</option>
          </select>
          <span className="muted activity-compact-count">{formatNumber(total)} مورد</span>
        </div>

        <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={6} />} loadingLabel="در حال بارگذاری فعالیت‌ها…">
        <section className="card activity-compact-card">
          {items.length === 0 ? (
            <EmptyState title="فعالیتي ثبت نشده" />
          ) : (
            <ul className="activity-compact-list">
              {items.map((a) => {
                const os = detectOs(a.userAgent);
                const on = isLightOn(a.outcome);
                return (
                  <li key={a.id}>
                    <button type="button" className="activity-compact-row" onClick={() => setSelected(a)}>
                      <span
                        className={`activity-light ${on ? 'on' : 'off'}`}
                        title={on ? 'روشن (موفق)' : 'خاموش (ناموفق/رد)'}
                        aria-label={on ? 'چراغ روشن' : 'چراغ خاموش'}
                      />
                      <span className="activity-compact-main">
                        <strong>{a.action}</strong>
                        <small>
                          {a.resource}
                          {a.resourceId ? ` · ${a.resourceId.slice(0, 8)}` : ''}
                        </small>
                      </span>
                      <span className="activity-compact-side">
                        <span className="activity-os" title={OS_LABELS[os]}>
                          <OsLogo os={os} size={15} />
                          <em>{OS_LABELS[os]}</em>
                        </span>
                        <span className="activity-ip" title="آی‌پی">
                          {a.ipAddress || '—'}
                        </span>
                        <time>{formatDateTime(a.createdAt)}</time>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {total > limit && (
            <div className="activity-compact-pager">
              <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                قبلی
              </button>
              <span>{formatNumber(page)}</span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={page * limit >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                بعدی
              </button>
            </div>
          )}
        </section>
        </QueryState>

        {selected && (
          <div className="activity-compact-drawer" role="dialog" aria-modal="true">
            <div className="activity-compact-drawer-card">
              <div className="card-head">
                <h3>
                  <NavIcon name="activity" size={16} /> جزئیات رویداد
                </h3>
                <button type="button" className="btn btn-sm" onClick={() => setSelected(null)}>بستن</button>
              </div>
              <dl className="activity-compact-details">
                <div><dt>عملیات</dt><dd>{selected.action}</dd></div>
                <div><dt>منبع</dt><dd>{selected.resource}</dd></div>
                <div><dt>نتیجه</dt><dd>{OUTCOME_LABEL[selected.outcome] || selected.outcome}</dd></div>
                <div>
                  <dt>وضعیت چراغ</dt>
                  <dd>
                    <span className={`activity-light inline ${isLightOn(selected.outcome) ? 'on' : 'off'}`} />
                    {isLightOn(selected.outcome) ? 'روشن' : 'خاموش'}
                  </dd>
                </div>
                <div><dt>آی‌پی</dt><dd className="mono">{selected.ipAddress || '—'}</dd></div>
                <div>
                  <dt>سیستم‌عامل</dt>
                  <dd className="activity-os-detail">
                    <OsLogo os={detectOs(selected.userAgent)} size={16} />
                    {OS_LABELS[detectOs(selected.userAgent)]}
                  </dd>
                </div>
                <div><dt>زمان</dt><dd>{formatDateTime(selected.createdAt)}</dd></div>
              </dl>
            </div>
          </div>
        )}
      </PermissionGate>
    </AppShell>
  );
}
