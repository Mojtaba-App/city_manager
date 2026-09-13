'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { EmptyState, PageHeader } from '@/components/admin/AdminUi';
import { NavIcon } from '@/components/NavIcons';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { apiFetch } from '@/lib/api';
import { formatMetric, formatNumber, toPersianDigits } from '@/lib/format';
import { VULNERABILITY_LEVEL_LABELS, VulnerabilityLevel, resolveDisplayedHouseholdCount } from '@city-manager/shared';

function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className="regen-section-hint muted">{children}</p>;
}

function num(row: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== '') return Number(v);
  }
  return 0;
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

export default function NeighborhoodsPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiFetch<Record<string, unknown>[]>('/gis/neighborhoods', {}).then((res) => {
      if (res.success && res.data) setItems(res.data);
      setLoading(false);
    });
  }, []);

  const totals = useMemo(() => {
    const households = items.reduce(
      (s, n) => s + resolveDisplayedHouseholdCount(n.household_count ?? n.householdCount, n.case_household_count ?? n.caseHouseholdCount),
      0,
    );
    const projects = items.reduce((s, n) => s + num(n, 'project_count', 'projectCount'), 0);
    const area = items.reduce((s, n) => s + num(n, 'area_sqm', 'areaSqm'), 0);
    const scored = items
      .map((n) => n.avg_vulnerability ?? n.avgVulnerability)
      .filter((v) => v != null && v !== '')
      .map(Number);
    const avgVuln = scored.length
      ? Math.round((scored.reduce((s, v) => s + v, 0) / scored.length) * 10) / 10
      : null;
    return { households, projects, area, avgVuln };
  }, [items]);

  return (
    <AppShell title="محلات">
      <div className="regen-page regen-neighborhoods-page">
        <PageHeader
          title="داشبورد محلات"
          description="آمار خانوار، پروژه و آسیب‌پذیری در سطح هر محله"
          actions={
            <div className="regen-header-actions">
              <Link href="/dashboard/programs" className="btn btn-sm">برنامه‌های بازآفرینی</Link>
              <Link href="/dashboard/map" className="btn btn-sm btn-primary">نقشه GIS</Link>
            </div>
          }
        />

        <section className="card regen-intro">
          <SectionHint>
            <strong>محله</strong> واحد اصلی بازآفرینی محله‌محور است — هر کارت سه شاخص خانوار، پروژه و
            {' '}
            <strong>آسیب‌پذیری</strong>
            {' '}
            را کنار هم نشان می‌دهد.
          </SectionHint>
        </section>

        <div className="nbhd-overview-stats">
          <div className="nbhd-overview-stat">
            <span>تعداد محلات</span>
            <strong>{formatNumber(items.length)}</strong>
          </div>
          <div className="nbhd-overview-stat is-household">
            <span>خانوار کل</span>
            <strong>{formatNumber(totals.households)}</strong>
          </div>
          <div className="nbhd-overview-stat is-project">
            <span>پروژه کل</span>
            <strong>{formatNumber(totals.projects)}</strong>
          </div>
          <div className={`nbhd-overview-stat is-vuln ${vulnTone(vulnLevel(totals.avgVuln))}`}>
            <span>میانگین آسیب‌پذیری</span>
            <strong>{totals.avgVuln != null ? formatNumber(totals.avgVuln) : '—'}</strong>
          </div>
          <div className="nbhd-overview-stat">
            <span>مساحت کل</span>
            <strong className="nbhd-metric-ltr" dir="ltr">
              {totals.area > 0 ? formatMetric(totals.area, 'm²') : '—'}
            </strong>
          </div>
        </div>

        <QueryState
          loading={loading}
          skeleton={<SkeletonList rows={6} />}
          loadingLabel="در حال بارگذاری محلات…"
        >
        {items.length === 0 ? (
          <EmptyState
            title="محله‌ای ثبت نشده"
            description="از نقشه یا مدیریت لایه‌ها محله تعریف کنید."
          />
        ) : (
          <div className="regen-neighborhood-grid">
            {items.map((n, idx) => {
              const households = resolveDisplayedHouseholdCount(
                n.household_count ?? n.householdCount,
                n.case_household_count ?? n.caseHouseholdCount,
              );
              const projects = num(n, 'project_count', 'projectCount');
              const rawVuln = n.avg_vulnerability ?? n.avgVulnerability;
              const vuln = rawVuln != null && rawVuln !== '' ? Number(rawVuln) : null;
              const level = vulnLevel(vuln);
              return (
                <article key={String(n.id)} className="regen-neighborhood-card">
                  <div className="regen-neighborhood-card-head">
                    <span className="nbhd-card-row-no" aria-label={`ردیف ${toPersianDigits(idx + 1)}`}>
                      {toPersianDigits(idx + 1)}
                    </span>
                    <div className="regen-scope-icon" aria-hidden>
                      <NavIcon name="neighborhood" size={20} />
                    </div>
                    <div className="regen-neighborhood-title">
                      <strong>{String(n.name)}</strong>
                      {n.code ? (
                        <code className="regen-program-code">{toPersianDigits(String(n.code))}</code>
                      ) : null}
                    </div>
                    {level && (
                      <span className={`nbhd-vuln-chip ${vulnTone(level)}`}>
                        {VULNERABILITY_LEVEL_LABELS[level]}
                      </span>
                    )}
                  </div>
                  <p className="regen-neighborhood-area muted">
                    {n.area_sqm ? (
                      <span className="nbhd-metric-ltr" dir="ltr">{formatMetric(Number(n.area_sqm), 'm²')}</span>
                    ) : (
                      'مساحت ثبت نشده'
                    )}
                  </p>
                  <div className="nbhd-card-metrics">
                    <div className="is-household">
                      <span>خانوار</span>
                      <strong>{formatNumber(households)}</strong>
                    </div>
                    <div className="is-project">
                      <span>پروژه</span>
                      <strong>{formatNumber(projects)}</strong>
                    </div>
                    <div className={`is-vuln ${vulnTone(level)}`}>
                      <span>آسیب‌پذیری</span>
                      <strong>{vuln != null ? formatNumber(vuln) : '—'}</strong>
                    </div>
                  </div>
                  {vuln != null && (
                    <div className={`nbhd-meter ${vulnTone(level)}`} aria-hidden>
                      <div className="nbhd-meter-fill" style={{ width: `${Math.min(100, Math.max(0, vuln))}%` }} />
                    </div>
                  )}
                  <div className="regen-program-actions">
                    <Link href={`/dashboard/neighborhoods/${String(n.id)}`} className="btn btn-sm btn-primary">
                      داشبورد محله
                    </Link>
                    <Link href={`/dashboard/map?neighborhood=${String(n.id)}`} className="btn btn-sm">
                      روی نقشه
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </QueryState>
      </div>
    </AppShell>
  );
}
