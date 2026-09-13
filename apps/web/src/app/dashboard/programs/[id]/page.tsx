'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { EmptyState, PageHeader } from '@/components/admin/AdminUi';
import { NavIcon } from '@/components/NavIcons';
import { fetchProgram } from '@/lib/regeneration-api';
import { formatMetric, formatNumber, toPersianDigits } from '@/lib/format';
import {
  AREA_PROJECT_STATUS_LABELS,
  REGENERATION_PROGRAM_STATUS_LABELS,
  RegenerationProgramStatus,
} from '@city-manager/shared';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className="regen-section-hint muted">{children}</p>;
}

function projectStatusTone(status: string): string {
  if (status === 'active') return 'ok';
  if (status === 'planned') return 'info';
  if (status === 'completed') return 'info';
  return 'off';
}

export default function ProgramDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const { loading, error, setError, run } = useQueryLoad();

  useEffect(() => {
    void run(async () => {
      const res = await fetchProgram(id);
      if (res.success && res.data) setData(res.data as Record<string, unknown>);
      else if (!res.success) setError(res.error?.message ?? 'بارگذاری برنامه ناموفق بود');
    });
  }, [id, run, setError]);

  const neighborhoods = (data?.neighborhoods as Record<string, unknown>[]) ?? [];
  const projects = (data?.projects as Record<string, unknown>[]) ?? [];
  const status = String(data?.status ?? '');

  return (
    <AppShell title="جزئیات برنامه">
      <div className="regen-page regen-program-detail">
        <PageHeader
          title={String(data?.name ?? 'جزئیات برنامه')}
          description={`کد برنامه: ${toPersianDigits(String(data?.code ?? '—'))}`}
          actions={
            <Link href="/dashboard/programs" className="btn btn-sm">
              ← بازگشت به برنامه‌ها
            </Link>
          }
        />

        <QueryState
          loading={loading}
          error={error}
          empty={!data}
          emptyMessage="برنامه یافت نشد"
          skeleton={<SkeletonList rows={6} />}
          loadingLabel="در حال بارگذاری جزئیات برنامه…"
        >
        {data?.description ? (
          <section className="card regen-intro">
            <p className="muted" style={{ margin: 0 }}>{String(data.description)}</p>
          </section>
        ) : null}

        <div className="regen-stats regen-stats-bar">
          <div className="regen-stat-card">
            <span>وضعیت</span>
            <strong className="regen-stat-label">
              {(REGENERATION_PROGRAM_STATUS_LABELS[status as RegenerationProgramStatus] ?? status) || '—'}
            </strong>
          </div>
          <div className="regen-stat-card regen-stat-highlight">
            <span>بودجه کل</span>
            <strong>{data?.budgetTotal ? formatMetric(Number(data.budgetTotal), 'ریال') : '—'}</strong>
          </div>
          <div className="regen-stat-card">
            <span>محله</span>
            <strong>{formatNumber(neighborhoods.length)}</strong>
          </div>
          <div className="regen-stat-card">
            <span>پروژه</span>
            <strong>{formatNumber(projects.length)}</strong>
          </div>
        </div>

        <div className="regen-detail-grid">
          <section className="card">
            <div className="card-head">
              <div>
                <h3>محلات تحت پوشش</h3>
                <SectionHint>
                  <strong>محدوده</strong> جغرافیایی برنامه — هر محله داشبورد جداگانه دارد.
                </SectionHint>
              </div>
            </div>
            {neighborhoods.length === 0 ? (
              <EmptyState title="محله‌ای متصل نیست" description="از نقشه یا مدیریت لایه‌ها محله را به برنامه link کنید." />
            ) : (
              <ul className="regen-scope-list">
                {neighborhoods.map((n) => (
                  <li key={String(n.id)} className="regen-scope-item">
                    <div className="regen-scope-icon" aria-hidden>
                      <NavIcon name="neighborhood" size={18} />
                    </div>
                    <div className="regen-scope-body">
                      <strong>{String(n.name)}</strong>
                      <small className="muted">کد {String(n.code ?? '—')}</small>
                    </div>
                    <Link href={`/dashboard/neighborhoods/${String(n.id)}`} className="btn btn-sm btn-primary">
                      داشبورد محله
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h3>پروژه‌های اجرایی</h3>
                <SectionHint>
                  پروژه واحد اجرا در محله — پیشرفت و بودجه در سطح پروژه رصد می‌شود.
                </SectionHint>
              </div>
            </div>
            {projects.length === 0 ? (
              <EmptyState title="پروژه‌ای ثبت نشده" description="از پنل نقشه یا پروژه‌های محله، پروژه جدید اضافه کنید." />
            ) : (
              <ul className="regen-project-list">
                {projects.map((p) => {
                  const progress = Math.min(100, Math.max(0, Number(p.progress_percent ?? 0)));
                  const pStatus = String(p.status ?? '');
                  return (
                    <li key={String(p.id)} className="regen-project-item">
                      <div className="regen-project-head">
                        <strong>{String(p.name)}</strong>
                        <span className={`status-pill ${projectStatusTone(pStatus)}`}>
                          {AREA_PROJECT_STATUS_LABELS[pStatus] ?? pStatus}
                        </span>
                      </div>
                      <div className="regen-project-progress">
                        <div className="regen-project-progress-track">
                          <div className="regen-project-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <span>{formatNumber(progress)}٪</span>
                      </div>
                      <div className="regen-project-meta muted">
                        {p.amount ? formatMetric(Number(p.amount), 'ریال') : 'بدون بودجه ثبت‌شده'}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        </QueryState>
      </div>
    </AppShell>
  );
}
