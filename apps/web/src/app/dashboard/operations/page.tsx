'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { fetchPriorityQueue, fetchMyTasks, fetchOverdueTasks } from '@/lib/operations-api';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import {
  CASE_TASK_STATUS_LABELS, VULNERABILITY_LEVEL_LABELS, CaseTaskStatus,
} from '@city-manager/shared';
import { formatNumber, toPersianDigits } from '@/lib/format';

const STATUS_LABELS: Record<string, string> = {
  draft: 'پیش‌نویس',
  active: 'فعال',
  suspended: 'معلق',
};

export default function OperationsPage() {
  const [queue, setQueue] = useState<Record<string, unknown>[]>([]);
  const [mine, setMine] = useState<Record<string, unknown>[]>([]);
  const [overdue, setOverdue] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    const [q, m, o] = await Promise.all([
      fetchPriorityQueue(30),
      fetchMyTasks(),
      fetchOverdueTasks(),
    ]);
    if (!q.success && !m.success && !o.success) {
      setError(q.error?.message ?? m.error?.message ?? o.error?.message ?? 'بارگذاری مرکز عملیات ناموفق بود');
    }
    if (q.success) setQueue((q.data as Record<string, unknown>[]) ?? []);
    if (m.success) setMine((m.data as Record<string, unknown>[]) ?? []);
    if (o.success) setOverdue((o.data as Record<string, unknown>[]) ?? []);
    setLoading(false);
  }

  return (
    <AppShell title="مرکز عملیات">
      <div className="ops-page">
        <header className="ops-hero">
          <div>
            <p className="ops-kicker">عملیات میدانی</p>
            <h2>مرکز عملیات پرونده</h2>
            <p className="ops-lead">صف اولویت، وظایف من و هشدارهای تأخیر</p>
          </div>
          <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
            بروزرسانی
          </button>
        </header>

        <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={5} />} loadingLabel="در حال بارگذاری مرکز عملیات…">
        <div className="ops-grid">
          <section className="card ops-panel">
            <h3>وظایف معوق ({formatNumber(overdue.length)})</h3>
            {overdue.length === 0 ? (
              <p className="muted">وظیفه معوقی نیست</p>
            ) : (
              <ul className="ops-list">
                {overdue.map((t) => (
                  <li key={String(t.id)} className="ops-list-item ops-overdue">
                    <strong>{String(t.title)}</strong>
                    <span>{CASE_TASK_STATUS_LABELS[t.status as CaseTaskStatus] ?? String(t.status)}</span>
                    <Link href={`/dashboard/households/${String(t.householdId)}`} className="btn btn-sm">
                      پرونده
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card ops-panel">
            <h3>وظایف من ({formatNumber(mine.length)})</h3>
            {mine.length === 0 ? (
              <p className="muted">وظیفه‌ای به شما محول نشده</p>
            ) : (
              <ul className="ops-list">
                {mine.map((t) => (
                  <li key={String(t.id)} className={`ops-list-item ${t.isOverdue ? 'ops-overdue' : ''}`}>
                    <strong>{String(t.title)}</strong>
                    <span>{CASE_TASK_STATUS_LABELS[t.status as CaseTaskStatus] ?? String(t.status)}</span>
                    <Link href={`/dashboard/households/${String(t.householdId)}`} className="btn btn-sm">
                      پرونده
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card ops-panel ops-panel-wide">
            <h3>صف اولویت آسیب‌پذیری</h3>
            {queue.length === 0 ? (
              <p className="muted">پرونده‌ای در صف نیست</p>
            ) : (
              <div className="ops-table-wrap">
                <table className="case-table">
                  <thead>
                    <tr>
                      <th>پرونده</th>
                      <th>وضعیت</th>
                      <th>امتیاز</th>
                      <th>سطح</th>
                      <th>اولویت</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((h) => (
                      <tr key={String(h.id)}>
                        <td>{toPersianDigits(String(h.caseNumber))}</td>
                        <td>{STATUS_LABELS[String(h.status)] ?? String(h.status)}</td>
                        <td>{h.vulnerabilityScore != null ? formatNumber(Number(h.vulnerabilityScore)) : '—'}</td>
                        <td>
                          {VULNERABILITY_LEVEL_LABELS[String(h.vulnerabilityLevel) as keyof typeof VULNERABILITY_LEVEL_LABELS]
                            ?? (h.vulnerabilityLevel ? String(h.vulnerabilityLevel) : '—')}
                        </td>
                        <td>{h.computedRank != null ? formatNumber(Number(h.computedRank)) : '—'}</td>
                        <td>
                          <Link href={`/dashboard/households/${String(h.id)}`} className="btn btn-sm btn-primary">
                            باز کردن
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        </QueryState>
      </div>
    </AppShell>
  );
}
