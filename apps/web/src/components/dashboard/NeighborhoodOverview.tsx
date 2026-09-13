'use client';

import { useMemo, useState } from 'react';
import { NeighborhoodChoropleth, resolveDisplayedPopulation } from '@city-manager/shared';
import { NavIcon } from '@/components/NavIcons';
import { formatNumber, formatMetric } from '@/lib/format';

type MetricKey = 'population' | 'householdCount' | 'avgIncome' | 'literacyRate' | 'areaSqm';

const METRICS: Array<{ key: MetricKey; label: string; unit?: string }> = [
  { key: 'population', label: 'جمعیت' },
  { key: 'householdCount', label: 'خانوار' },
  { key: 'avgIncome', label: 'میانگین درآمد', unit: 'ریال' },
  { key: 'literacyRate', label: 'سطح سواد', unit: '٪' },
  { key: 'areaSqm', label: 'مساحت', unit: 'm²' },
];

type Row = NeighborhoodChoropleth & {
  population?: number;
  literacyRate?: number;
  areaSqm?: number;
  household_count?: number;
  area_sqm?: number;
};

function metricValue(row: Row, key: MetricKey): number {
  if (key === 'literacyRate') return Number(row.literacyRate ?? 0);
  if (key === 'avgIncome') return Number(row.avgIncome ?? 0);
  if (key === 'areaSqm') return Number(row.areaSqm ?? row.area_sqm ?? 0);
  if (key === 'population') return resolveDisplayedPopulation(row.population, 0);
  return Number(row.householdCount ?? row.household_count ?? 0);
}

function formatMetricValue(row: Row, key: MetricKey): string {
  const v = metricValue(row, key);
  if (key === 'literacyRate') return `${formatNumber(Math.round(v))}٪`;
  if (key === 'avgIncome') return formatMetric(Math.round(v), 'ریال');
  if (key === 'areaSqm') return formatMetric(Math.round(v), 'm²');
  return formatNumber(v);
}

export function NeighborhoodOverview({
  items,
  loading,
}: {
  items: Row[];
  loading?: boolean;
}) {
  const [metric, setMetric] = useState<MetricKey>('population');

  const ranked = useMemo(() => {
    return [...items]
      .map((n) => ({ ...n, value: metricValue(n, metric) }))
      .sort((a, b) => b.value - a.value);
  }, [items, metric]);

  const max = Math.max(...ranked.map((r) => r.value), 1);
  const activeMeta = METRICS.find((m) => m.key === metric)!;

  return (
    <section className="card dash-neighborhoods">
      <div className="card-head">
        <div>
          <h3 className="dash-section-title">
            <NavIcon name="neighborhood" size={18} />
            نمای شماتیک محلات
          </h3>
          <p className="muted dash-neighborhoods-lead">
            مقایسه محلات از نظر جمعیت، درآمد، سواد، مساحت و تعداد خانوار
            {!loading && ranked.length > 0 ? ` · ${formatNumber(ranked.length)} محله` : ''}
          </p>
        </div>
      </div>

      <div className="dash-metric-tabs" role="tablist" aria-label="شاخص محله">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={metric === m.key}
            className={`dash-metric-tab ${metric === m.key ? 'active' : ''}`}
            onClick={() => setMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">در حال بارگذاری آمار محلات…</p>
      ) : ranked.length === 0 ? (
        <p className="muted">هنوز محله‌ای با داده ثبت نشده است.</p>
      ) : (
        <div className="dash-nbhd-chart">
          {ranked.map((row, idx) => {
            const width = Math.max(6, (row.value / max) * 100);
            return (
              <div key={row.neighborhoodId} className="dash-nbhd-row">
                <div className="dash-nbhd-rank">{formatNumber(idx + 1)}</div>
                <div className="dash-nbhd-meta">
                  <strong>{row.name}</strong>
                  <span>{row.code ? `کد ${row.code}` : '—'}</span>
                </div>
                <div className="dash-nbhd-bar-track" title={`${activeMeta.label}: ${formatMetricValue(row, metric)}`}>
                  <div
                    className="dash-nbhd-bar-fill"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div
                  className={`dash-nbhd-value${metric === 'areaSqm' ? ' dash-nbhd-value-area' : ''}`}
                  dir="ltr"
                >
                  {formatMetricValue(row, metric)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && ranked.length > 0 && (
        <div className="dash-nbhd-cards">
          {ranked.map((row) => (
            <article key={`card-${row.neighborhoodId}`} className="dash-nbhd-card">
              <header>
                <strong>{row.name}</strong>
                <span>{row.code || '—'}</span>
              </header>
              <dl>
                <div><dt>جمعیت</dt><dd dir="ltr">{formatNumber(resolveDisplayedPopulation(row.population, 0))}</dd></div>
                <div><dt>خانوار</dt><dd dir="ltr">{formatNumber(row.householdCount ?? row.household_count ?? 0)}</dd></div>
                <div><dt>درآمد</dt><dd dir="ltr">{row.avgIncome != null ? formatMetric(Math.round(row.avgIncome), 'ریال') : '—'}</dd></div>
                <div><dt>سواد</dt><dd dir="ltr">{row.literacyRate != null ? `${formatNumber(Math.round(row.literacyRate))}٪` : '—'}</dd></div>
                <div>
                  <dt>مساحت</dt>
                  <dd className="dash-nbhd-area" dir="ltr">
                    {(row.areaSqm ?? row.area_sqm) != null
                      ? formatMetric(Math.round(Number(row.areaSqm ?? row.area_sqm)), 'm²')
                      : '—'}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
