'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import {
  completeFieldVisit,
  fetchFieldToday,
  fetchMyVisits,
  fieldSearch,
} from '@/lib/collaboration-api';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useFeedback } from '@/components/ui/Feedback';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { FieldVisitStatus, FIELD_VISIT_STATUS_LABELS, FIELD_CHANNEL_FIELDS } from '@city-manager/shared';
import { PermissionGate } from '@/components/admin/AdminUi';
import { useAuth } from '@/lib/auth';

function visitStatusLabel(status: unknown): string {
  const key = String(status) as FieldVisitStatus;
  return FIELD_VISIT_STATUS_LABELS[key] ?? String(status);
}

export default function FieldPage() {
  const { hasPermission } = useAuth();
  const feedback = useFeedback();
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [visits, setVisits] = useState<Array<Record<string, unknown>>>([]);
  const [query, setQuery] = useState('');
  const [searchHits, setSearchHits] = useState<Array<Record<string, unknown>>>([]);
  const [activeVisit, setActiveVisit] = useState<string | null>(null);
  const [findings, setFindings] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [s, v] = await Promise.all([fetchFieldToday(), fetchMyVisits()]);
    if (!s.success && !v.success) {
      setError(s.error?.message ?? v.error?.message ?? 'بارگذاری داده میدانی ناموفق بود');
    }
    if (s.success && s.data) setSummary(s.data);
    if (v.success && v.data) setVisits(v.data);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function search() {
    if (query.trim().length < 2) return;
    const res = await fieldSearch(query.trim());
    if (res.success && res.data) setSearchHits(res.data);
  }

  async function completeVisit(visitId: string) {
    setBusy(true);
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        /* optional GPS */
      }
    }
    const res = await completeFieldVisit(visitId, {
      findings: findings.trim() || undefined,
      latitude,
      longitude,
      status: 'completed',
    });
    setBusy(false);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ثبت بازدید ناموفق');
      return;
    }
    feedback.success('بازدید ثبت شد');
    setActiveVisit(null);
    setFindings('');
    void load();
  }

  return (
    <AppShell title="کانال میدانی">
      <PermissionGate allow={hasPermission('households:read') || hasPermission('field:access') || hasPermission('operations:read')}>
      <div className="collab-page field-page">
        <header className="collab-hero">
          <div>
            <h2>کار میدانی مددکار</h2>
            <p className="collab-lead">بازدیدهای امروز، جستجوی پلاک/پرونده، ثبت یافته با موقعیت</p>
          </div>
        </header>

        <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={4} />} loadingLabel="در حال بارگذاری عملیات میدانی…">
          <div className="regen-stats card">
            <div><span>امروز</span><strong>{formatNumber(summary.scheduledToday ?? 0)}</strong></div>
            <div><span>تکمیل‌شده</span><strong>{formatNumber(summary.completedToday ?? 0)}</strong></div>
            <div><span>سررسید گذشته</span><strong>{formatNumber(summary.overdue ?? 0)}</strong></div>
          </div>

          <section className="card">
            <h3>جستجوی سریع</h3>
            <div className="field-search-row">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={FIELD_CHANNEL_FIELDS.search.placeholder}
                aria-label={FIELD_CHANNEL_FIELDS.search.label}
                inputMode={FIELD_CHANNEL_FIELDS.search.inputMode}
                onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
              />
              <button type="button" className="btn btn-primary" onClick={() => void search()}>جستجو</button>
            </div>
            {searchHits.length > 0 && (
              <ul className="ops-list">
                {searchHits.map((h) => (
                  <li key={String(h.household_id)} className="ops-list-item">
                    <div>
                      <strong>{String(h.case_number)}</strong>
                      <small>{String(h.full_address ?? h.plaque ?? '—')}</small>
                    </div>
                    <Link href={`/dashboard/households/${String(h.household_id)}`} className="btn btn-sm">پرونده</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h3>بازدیدهای من</h3>
            {visits.length === 0 ? (
              <p className="muted">بازدیدی برنامه‌ریزی نشده</p>
            ) : (
              <ul className="field-visit-list">
                {visits.map((v) => {
                  const status = String(v.status);
                  const isScheduled = status === FieldVisitStatus.SCHEDULED;
                  return (
                    <li key={String(v.id)} className={isScheduled ? 'field-pending' : ''}>
                      <div>
                        <strong>{String(v.case_number)}</strong>
                        <small>{formatDateTime(String(v.scheduled_at))}</small>
                        <small>{String(v.full_address ?? v.address_note ?? '—')}</small>
                        <span className="regen-badge">{visitStatusLabel(v.status)}</span>
                      </div>
                      {isScheduled && (
                        activeVisit === String(v.id) ? (
                          <div className="field-complete-form">
                            <textarea rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder={FIELD_CHANNEL_FIELDS.notes.placeholder} aria-label={FIELD_CHANNEL_FIELDS.notes.label} />
                            <div className="regen-card-actions">
                              <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void completeVisit(String(v.id))}>
                                {busy ? '…' : 'ثبت تکمیل'}
                              </button>
                              <button type="button" className="btn btn-sm" onClick={() => setActiveVisit(null)}>لغو</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => setActiveVisit(String(v.id))}>
                            تکمیل بازدید
                          </button>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </QueryState>
      </div>
      </PermissionGate>
    </AppShell>
  );
}
