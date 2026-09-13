'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { EmptyState, PageHeader } from '@/components/admin/AdminUi';
import { NavIcon } from '@/components/NavIcons';
import { fetchNeighborhoodDashboard } from '@/lib/regeneration-api';
import {
  AREA_PROJECT_STATUS_LABELS,
  VULNERABILITY_LEVEL_LABELS,
  VulnerabilityLevel,
} from '@city-manager/shared';
import { formatMetric, formatNumber } from '@/lib/format';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonCard } from '@/components/ui/Skeleton';

function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className="regen-section-hint muted">{children}</p>;
}

function projectStatusTone(status: string): string {
  if (status === 'active') return 'ok';
  if (status === 'planned') return 'info';
  if (status === 'completed') return 'info';
  return 'off';
}

function vulnLevel(score: number | null): VulnerabilityLevel | null {
  if (score == null) return null;
  if (score >= 75) return VulnerabilityLevel.CRITICAL;
  if (score >= 55) return VulnerabilityLevel.HIGH;
  if (score >= 35) return VulnerabilityLevel.MEDIUM;
  return VulnerabilityLevel.LOW;
}

function vulnTone(level: VulnerabilityLevel | null): string {
  if (level === VulnerabilityLevel.CRITICAL) return 'critical';
  if (level === VulnerabilityLevel.HIGH) return 'high';
  if (level === VulnerabilityLevel.MEDIUM) return 'medium';
  if (level === VulnerabilityLevel.LOW) return 'low';
  return 'none';
}

export default function NeighborhoodDashboardPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchNeighborhoodDashboard(id).then((res) => {
      if (res.success && res.data) setData(res.data as Record<string, unknown>);
      setLoading(false);
    });
  }, [id]);

  const nb = data?.neighborhood as Record<string, unknown> | undefined;
  const projects = (data?.projects as Record<string, unknown>[]) ?? [];
  const householdCount = Number(data?.householdCount ?? 0);
  const memberCount = Number(data?.memberCount ?? 0);
  const avgVuln = data?.avgVulnerability != null ? Number(data.avgVulnerability) : null;
  const level = vulnLevel(avgVuln);
  const activeProjects = Number(data?.activeProjectCount ?? 0);
  const projectCount = Number(data?.projectCount ?? projects.length);
  const avgProgress = Math.min(100, Math.max(0, Number(data?.avgProgress ?? 0)));
  const budget = Number(data?.totalProjectBudget ?? 0);

  return (
    <AppShell title="داشبورد محله">
      <div className="regen-page regen-neighborhood-detail">
        <PageHeader
          title={String(nb?.name ?? 'داشبورد محله')}
          description={`کد محله: ${String(nb?.code ?? '—')}`}
          actions={
            <div className="regen-header-actions">
              <Link href="/dashboard/neighborhoods" className="btn btn-sm">← محلات</Link>
              <Link href={`/dashboard/map?neighborhood=${id}`} className="btn btn-sm btn-primary">نمایش روی نقشه</Link>
            </div>
          }
        />

        <QueryState
          loading={loading}
          skeleton={<SkeletonCard />}
          loadingLabel="در حال بارگذاری آمار محله…"
        >
          <>
            <div className="nbhd-kpi-grid">
              <section className="nbhd-kpi-card is-household">
                <div className="nbhd-kpi-head">
                  <div className="nbhd-kpi-icon" aria-hidden>
                    <NavIcon name="households" size={20} />
                  </div>
                  <div>
                    <h3>خانوار</h3>
                    <p>پرونده‌های ثبت‌شده در این محله</p>
                  </div>
                </div>
                <strong className="nbhd-kpi-value">{formatNumber(householdCount)}</strong>
                <dl className="nbhd-kpi-meta">
                  <div>
                    <dt>اعضا</dt>
                    <dd>{formatNumber(memberCount)}</dd>
                  </div>
                  <div>
                    <dt>میانگین نفر در خانوار</dt>
                    <dd>
                      {householdCount > 0
                        ? formatNumber(Math.round((memberCount / householdCount) * 10) / 10)
                        : '—'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className={`nbhd-kpi-card is-vuln ${vulnTone(level)}`}>
                <div className="nbhd-kpi-head">
                  <div className="nbhd-kpi-icon" aria-hidden>
                    <NavIcon name="activity" size={20} />
                  </div>
                  <div>
                    <h3>آسیب‌پذیری</h3>
                    <p>میانگین امتیاز خانوارها (۰ تا ۱۰۰)</p>
                  </div>
                </div>
                <div className="nbhd-kpi-value-row">
                  <strong className="nbhd-kpi-value">
                    {avgVuln != null ? formatNumber(avgVuln) : '—'}
                  </strong>
                  {level && (
                    <span className={`nbhd-vuln-chip ${vulnTone(level)}`}>
                      {VULNERABILITY_LEVEL_LABELS[level]}
                    </span>
                  )}
                </div>
                <div className={`nbhd-meter lg ${vulnTone(level)}`} aria-hidden>
                  <div
                    className="nbhd-meter-fill"
                    style={{ width: `${avgVuln != null ? Math.min(100, Math.max(0, avgVuln)) : 0}%` }}
                  />
                </div>
                <p className="nbhd-kpi-footnote muted">
                  پایین کمتر از ۳۵ · متوسط ۳۵ · بالا ۵۵ · بحرانی ۷۵
                </p>
              </section>

              <section className="nbhd-kpi-card is-project">
                <div className="nbhd-kpi-head">
                  <div className="nbhd-kpi-icon" aria-hidden>
                    <NavIcon name="layers" size={20} />
                  </div>
                  <div>
                    <h3>پروژه</h3>
                    <p>وضعیت اجرای پروژه‌های محله</p>
                  </div>
                </div>
                <div className="nbhd-kpi-value-row">
                  <strong className="nbhd-kpi-value">{formatNumber(activeProjects)}</strong>
                  <span className="nbhd-kpi-suffix muted">فعال از {formatNumber(projectCount)}</span>
                </div>
                <dl className="nbhd-kpi-meta">
                  <div>
                    <dt>بودجه</dt>
                    <dd>{budget > 0 ? formatMetric(budget, 'ریال') : '—'}</dd>
                  </div>
                  <div>
                    <dt>میانگین پیشرفت</dt>
                    <dd>{formatNumber(avgProgress)}٪</dd>
                  </div>
                </dl>
                <div className="nbhd-meter is-progress" aria-hidden>
                  <div className="nbhd-meter-fill" style={{ width: `${avgProgress}%` }} />
                </div>
              </section>
            </div>

            <section className="card">
              <div className="card-head">
                <div>
                  <h3>پروژه‌های محله</h3>
                  <SectionHint>
                    پروژه‌های اجرایی در این محدوده — پیشرفت و بودجه در سطح هر پروژه.
                  </SectionHint>
                </div>
              </div>
              {projects.length === 0 ? (
                <EmptyState title="پروژه‌ای ثبت نشده" description="از نقشه یا پنل پروژه‌های محله، پروژه جدید اضافه کنید." />
              ) : (
                <ul className="regen-project-list nbhd-project-grid">
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
                          {p.contractor_name ? `پیمانکار: ${String(p.contractor_name)} · ` : ''}
                          {p.amount ? formatMetric(Number(p.amount), 'ریال') : 'بدون بودجه ثبت‌شده'}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        </QueryState>
      </div>
    </AppShell>
  );
}
