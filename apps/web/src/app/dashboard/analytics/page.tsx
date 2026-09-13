'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader, PermissionGate, StatCard } from '@/components/admin/AdminUi';
import { useAuth } from '@/lib/auth';
import { AnalyticsFilters } from '@/components/analytics/AnalyticsFilters';
import { BarChart, DonutChart, LineChart } from '@/components/analytics/Charts';
import type { AnalyticsHeatmapHandle } from '@/components/analytics/AnalyticsHeatmap';
import { AnalyticsReportLayoutModal } from '@/components/analytics/AnalyticsReportLayoutModal';
import {
  fetchAnalyticsOverview, fetchAnalyticsFilters, fetchHeatmap, fetchChoropleth,
  fetchKpiConfig, saveKpiConfig,
  AnalyticsOverview, AnalyticsFilter, KpiDefinitionConfig,
} from '@/lib/analytics-api';
import {
  AnalyticsReportFormat,
  analyticsFilterHasErrors,
  analyticsFiltersEqual,
  describeAnalyticsFilter,
  firstAnalyticsFilterError,
  firstQueryFailure,
  HeatmapPoint,
  isDefaultAnalyticsFilter,
  NeighborhoodChoropleth,
  DEFAULT_KPI_DEFINITIONS,
  KPI_GROUP_GENERAL_FA,
  kpiMetricLabelFa,
  normalizeAnalyticsFilter,
  validateAnalyticsFilter,
} from '@city-manager/shared';
import { SavedFiltersBar } from '@/components/filters/SavedFiltersBar';
import { formatMetric, formatNumber } from '@/lib/format';
import { LoadingOverlay, LoadingButton } from '@/components/ui/LoadingSpinner';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useFeedback } from '@/components/ui/Feedback';
import { useQueryLoad } from '@/lib/use-query-load';

const AnalyticsHeatmap = dynamic(
  () => import('@/components/analytics/AnalyticsHeatmap').then((m) => m.AnalyticsHeatmap),
  { ssr: false },
);

function formatKpi(value: string | number, format?: string, unit?: string) {
  if (value === '—' || value == null) return '—';
  if (format === 'currency') return formatMetric(value, unit);
  if (format === 'percent') return `${formatNumber(value)}${unit ?? '%'}`;
  return formatMetric(value, unit);
}

function distTotal(buckets: Array<{ count: number }> | undefined) {
  return (buckets ?? []).reduce((s, b) => s + (b.count || 0), 0);
}

export default function AnalyticsPage() {
  const { hasPermission, profile } = useAuth();
  const feedback = useFeedback();
  const mapRef = useRef<AnalyticsHeatmapHandle>(null);
  const [filters, setFilters] = useState<AnalyticsFilter>({});
  const [draft, setDraft] = useState<AnalyticsFilter>({});
  const [filterErrors, setFilterErrors] = useState(validateAnalyticsFilter({}));
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [filterOptions, setFilterOptions] = useState<{
    neighborhoods: Array<{ id: string; name: string }>;
    householdStatuses: Array<{ key: string; label: string }>;
    ownershipTypes: Array<{ key: string; label: string }>;
    educationLevels: Array<{ key: string; label: string }>;
    employmentStatuses: Array<{ key: string; label: string }>;
  } | null>(null);
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodChoropleth[]>([]);
  const [kpiConfig, setKpiConfig] = useState<KpiDefinitionConfig[]>(DEFAULT_KPI_DEFINITIONS);
  const [showKpiEditor, setShowKpiEditor] = useState(false);
  const [savingKpis, setSavingKpis] = useState(false);
  const [exporting, setExporting] = useState<AnalyticsReportFormat | null>(null);
  const [reportFormat, setReportFormat] = useState<AnalyticsReportFormat | null>(null);
  const [mapSnapshot, setMapSnapshot] = useState<string | null>(null);
  const { loading, error, setError, run } = useQueryLoad();

  const producerDefault = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')
    || profile?.email
    || '';

  useEffect(() => {
    if (!hasPermission('reports:read')) return;
    fetchAnalyticsFilters().then((r) => {
      if (r.success && r.data) setFilterOptions(r.data);
    });
    fetchKpiConfig().then((r) => {
      if (r.success && r.data) {
        setKpiConfig(r.data.map((k) => ({
          ...k,
          group: k.group || KPI_GROUP_GENERAL_FA,
          title: k.title || kpiMetricLabelFa(k.metric),
        })));
      }
    });
  }, [hasPermission]);

  useEffect(() => {
    if (!hasPermission('reports:read')) return;
    void load();
  }, [filters, hasPermission]);

  async function load() {
    await run(async () => {
      const [ov, heat, choro] = await Promise.all([
        fetchAnalyticsOverview(filters),
        fetchHeatmap(filters),
        fetchChoropleth(filters),
      ]);
      if (ov.success && ov.data) setOverview(ov.data);
      if (heat.success && heat.data) setPoints(heat.data.points ?? []);
      if (choro.success && choro.data) setNeighborhoods(choro.data);
      const fail = firstQueryFailure([ov, heat, choro]);
      if (fail) setError(fail);
    });
  }

  function applyDraftFilters() {
    const next = normalizeAnalyticsFilter(draft);
    const errors = validateAnalyticsFilter(next);
    setFilterErrors(errors);
    if (analyticsFilterHasErrors(errors)) {
      void feedback.alert(
        firstAnalyticsFilterError(errors) ?? 'فیلترها را اصلاح کنید',
        'اعتبارسنجی فیلتر',
      );
      return;
    }
    setDraft(next);
    setFilters(next);
  }

  function resetFilters() {
    setDraft({});
    setFilters({});
    setFilterErrors({});
  }

  async function persistKpis() {
    setSavingKpis(true);
    try {
      const res = await saveKpiConfig(kpiConfig.map((k) => ({
        ...k,
        group: k.group || KPI_GROUP_GENERAL_FA,
      })));
      if (res.success) {
        feedback.success('پیکربندی شاخص‌ها ذخیره شد');
        setShowKpiEditor(false);
        void load();
      } else {
        await feedback.alert(res.error?.message ?? 'خطا', 'تنظیم شاخص‌ها');
      }
    } finally {
      setSavingKpis(false);
    }
  }

  async function openReportLayout(kind: AnalyticsReportFormat) {
    if (!overview) {
      await feedback.alert('ابتدا داده‌های تحلیل را بارگذاری کنید', 'خروجی گزارش');
      return;
    }
    if (!analyticsFiltersEqual(draft, filters)) {
      await feedback.alert(
        'تغییرات فیلتر هنوز اعمال نشده‌اند. ابتدا «اعمال فیلتر» را بزنید، سپس خروجی بگیرید.',
        'خروجی گزارش',
      );
      return;
    }
    const errors = validateAnalyticsFilter(filters);
    setFilterErrors(errors);
    if (analyticsFilterHasErrors(errors)) {
      await feedback.alert(
        firstAnalyticsFilterError(errors) ?? 'فیلترها نامعتبر است',
        'خروجی گزارش',
      );
      return;
    }
    if (isDefaultAnalyticsFilter(filters)) {
      const ok = await feedback.confirm(
        'هیچ فیلتری انتخاب نشده؛ گزارش برای همه داده‌های سازمان ساخته می‌شود. ادامه می‌دهید؟',
        'خروجی گزارش کامل',
        { confirmLabel: 'ادامه', cancelLabel: 'انصراف' },
      );
      if (!ok) return;
    }

    setMapSnapshot(mapRef.current?.captureMapDataUrl() ?? null);
    setReportFormat(kind);
  }

  const enabledCodes = new Set(kpiConfig.filter((k) => k.enabled).map((k) => k.code));
  const visibleKpis = (overview?.kpis ?? [])
    .filter((k) => enabledCodes.has(k.code))
    .sort((a, b) => {
      const ao = kpiConfig.find((x) => x.code === a.code)?.sortOrder ?? 99;
      const bo = kpiConfig.find((x) => x.code === b.code)?.sortOrder ?? 99;
      return ao - bo;
    });

  const readiness = useMemo(() => {
    const income = distTotal(overview?.distributions.income);
    const education = distTotal(overview?.distributions.education);
    const employment = distTotal(overview?.distributions.employment);
    const ownership = distTotal(overview?.distributions.ownership);
    const hhTs = overview?.timeSeries.householdsRegistered?.length ?? 0;
    return [
      { key: 'filters', label: 'فیلترها معتبر', ok: !analyticsFilterHasErrors(validateAnalyticsFilter(draft)) },
      { key: 'applied', label: 'فیلتر پیش‌نویس = اعمال‌شده', ok: analyticsFiltersEqual(draft, filters) },
      { key: 'income', label: 'توزیع درآمد', ok: income > 0, detail: income ? `${formatNumber(income)} عضو` : 'بدون داده' },
      { key: 'education', label: 'توزیع تحصیلات', ok: education > 0, detail: education ? `${formatNumber(education)} عضو` : 'بدون داده' },
      { key: 'employment', label: 'توزیع شغل', ok: employment > 0, detail: employment ? `${formatNumber(employment)} عضو` : 'بدون داده' },
      { key: 'ownership', label: 'توزیع مالکیت', ok: ownership > 0, detail: ownership ? `${formatNumber(ownership)} خانوار` : 'بدون داده' },
      { key: 'spatial', label: 'تحلیل فضایی', ok: points.length > 0 || neighborhoods.some((n) => n.geometry), detail: `${formatNumber(points.length)} نقطه · ${formatNumber(neighborhoods.length)} محله` },
      { key: 'timeseries', label: 'سری زمانی', ok: hhTs > 0, detail: hhTs ? `${formatNumber(hhTs)} دوره` : 'بدون داده' },
    ];
  }, [draft, filters, overview, points, neighborhoods]);

  const showInitialSkeleton = loading && !overview;

  const kpiByGroup = useMemo(() => {
    const map = new Map<string, Array<{ k: KpiDefinitionConfig; idx: number }>>();
    kpiConfig.forEach((k, idx) => {
      const g = k.group || KPI_GROUP_GENERAL_FA;
      const list = map.get(g) ?? [];
      list.push({ k, idx });
      map.set(g, list);
    });
    if (!map.has(KPI_GROUP_GENERAL_FA)) map.set(KPI_GROUP_GENERAL_FA, []);
    return map;
  }, [kpiConfig]);

  return (
    <AppShell title="داشبورد تحلیلی">
      <LoadingOverlay
        open={exporting != null}
        label={
          exporting === 'pdf'
            ? 'در حال ساخت گزارش PDF…'
            : exporting === 'excel'
              ? 'در حال ساخت فایل Excel…'
              : 'در حال ساخت فایل CSV…'
        }
        hint="چیدمان و نمودارهای انتخاب‌شده در حال آماده‌سازی خروجی هستند"
      />
      <PermissionGate allow={hasPermission('reports:read')}>
        <PageHeader
          title="تحلیل و گزارش‌گیری شهری"
          description="توزیع درآمد، تحصیلات، شغل، مالکیت، تحلیل فضایی و خروجی گزارش"
          actions={
            <div className="admin-quick-links">
              <LoadingButton
                className="btn"
                loading={exporting === 'csv'}
                loadingLabel="CSV…"
                disabled={loading || !overview || exporting != null}
                onClick={() => void openReportLayout('csv')}
              >
                CSV
              </LoadingButton>
              <LoadingButton
                className="btn"
                loading={exporting === 'excel'}
                loadingLabel="Excel…"
                disabled={loading || !overview || exporting != null}
                onClick={() => void openReportLayout('excel')}
              >
                Excel
              </LoadingButton>
              <LoadingButton
                className="btn btn-primary"
                loading={exporting === 'pdf'}
                loadingLabel="PDF…"
                disabled={loading || !overview || exporting != null}
                onClick={() => void openReportLayout('pdf')}
              >
                PDF
              </LoadingButton>
              {hasPermission('reports:write') && (
                <button
                  type="button"
                  className={`btn${showKpiEditor ? ' btn-primary' : ''}`}
                  aria-expanded={showKpiEditor}
                  aria-controls="analytics-kpi-editor"
                  onClick={() => setShowKpiEditor(true)}
                >
                  تنظیم شاخص‌ها
                </button>
              )}
            </div>
          }
        />

        <SavedFiltersBar
          scope="analytics"
          currentFilter={draft}
          onApply={(preset) => {
            const next = normalizeAnalyticsFilter(preset);
            const errors = validateAnalyticsFilter(next);
            setFilterErrors(errors);
            if (analyticsFilterHasErrors(errors)) {
              void feedback.alert(
                firstAnalyticsFilterError(errors) ?? 'پیش‌فرض فیلتر نامعتبر است',
                'فیلتر ذخیره‌شده',
              );
              return;
            }
            setDraft(next);
            setFilters(next);
          }}
          equals={analyticsFiltersEqual}
          describe={describeAnalyticsFilter}
          isDefault={isDefaultAnalyticsFilter}
        />

        <AnalyticsFilters
          filters={draft}
          options={filterOptions}
          errors={filterErrors}
          onChange={(next) => {
            setDraft(next);
            setFilterErrors(validateAnalyticsFilter(next));
          }}
          onApply={applyDraftFilters}
          onReset={resetFilters}
        />

        <div className="card analytics-status-bar">
          <div>
            <strong>فیلتر اعمال‌شده:</strong>{' '}
            <span className="muted">{describeAnalyticsFilter(filters)}</span>
          </div>
          {loading && overview && <span className="analytics-refresh-hint">در حال به‌روزرسانی…</span>}
          {!analyticsFiltersEqual(draft, filters) && (
            <span className="analytics-draft-warn" role="status">
              پیش‌نویس فیلتر با نتیجه فعلی یکی نیست — برای به‌روزرسانی «اعمال فیلتر» را بزنید
            </span>
          )}
        </div>

        <section className="card analytics-readiness">
          <div className="card-head">
            <div>
              <h3>آمادگی تست نهایی</h3>
              <p className="muted">وضعیت اعتبارسنجی فیلتر و وجود داده در بخش‌های تحلیلی</p>
            </div>
          </div>
          <ul className="analytics-readiness-list">
            {readiness.map((item) => (
              <li key={item.key} className={item.ok ? 'ok' : 'warn'}>
                <span className="analytics-readiness-mark" aria-hidden>{item.ok ? '✓' : '!'}</span>
                <span>
                  <strong>{item.label}</strong>
                  {item.detail ? <small className="muted"> — {item.detail}</small> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {error && !overview && (
          <div className="query-state-error" role="alert">
            <p>{error}</p>
          </div>
        )}

        {showInitialSkeleton ? (
          <div className="analytics-loading-grid">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            <div className="admin-stats-grid">
              {(visibleKpis.length ? visibleKpis : overview?.kpis ?? []).map((k) => (
                <StatCard
                  key={k.id}
                  label={k.title}
                  value={formatKpi(k.value, k.format, k.unit)}
                  hint={k.description}
                  tone={k.code.includes('unemploy') ? 'warning' : 'info'}
                />
              ))}
            </div>

            <div className="analytics-charts-grid">
              <BarChart
                title="توزیع درآمد"
                subtitle={distTotal(overview?.distributions.income) ? `${formatNumber(distTotal(overview?.distributions.income))} عضو` : undefined}
                data={overview?.distributions.income ?? []}
                color="#0f7a4c"
              />
              <DonutChart
                title="توزیع مالکیت"
                subtitle={distTotal(overview?.distributions.ownership) ? `${formatNumber(distTotal(overview?.distributions.ownership))} خانوار` : undefined}
                data={overview?.distributions.ownership ?? []}
              />
              <BarChart
                title="توزیع تحصیلات"
                subtitle={distTotal(overview?.distributions.education) ? `${formatNumber(distTotal(overview?.distributions.education))} عضو` : undefined}
                data={overview?.distributions.education ?? []}
                color="#175cd3"
              />
              <DonutChart
                title="توزیع شغل / اشتغال"
                subtitle={distTotal(overview?.distributions.employment) ? `${formatNumber(distTotal(overview?.distributions.employment))} عضو` : undefined}
                data={overview?.distributions.employment ?? []}
              />
            </div>

            <div className="analytics-charts-grid" style={{ marginTop: '1rem' }}>
              <LineChart
                title="گزارش زمان‌محور — ثبت خانوار"
                series={overview?.timeSeries.householdsRegistered ?? []}
                color="#0f4c5c"
              />
              <LineChart
                title="گزارش زمان‌محور — رویدادهای خط سیر"
                series={overview?.timeSeries.trajectoryEvents ?? []}
                color="#c46b2b"
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <AnalyticsHeatmap ref={mapRef} points={points} neighborhoods={neighborhoods} />
            </div>
          </>
        )}

        {showKpiEditor && (
          <div
            className="gis-upload-modal analytics-kpi-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="analytics-kpi-editor-title"
            id="analytics-kpi-editor"
            onClick={(e) => {
              if (e.target === e.currentTarget && !savingKpis) setShowKpiEditor(false);
            }}
          >
            <div className="gis-upload-card analytics-kpi-card">
              <h3 id="analytics-kpi-editor-title">تنظیم شاخص‌ها (KPI)</h3>
              <p className="gis-panel-hint">
                گروه پیش‌فرض: {KPI_GROUP_GENERAL_FA} — شاخص‌های فعال در داشبورد و گزارش دیده می‌شوند.
              </p>
              {[...kpiByGroup.entries()].map(([group, items]) => (
                <div key={group} className="analytics-kpi-group">
                  <h4 className="branding-section-title">{group}</h4>
                  <div className="perm-grid">
                    {items.map(({ k, idx }) => (
                      <label key={k.code} className="perm-item">
                        <input
                          type="checkbox"
                          checked={k.enabled}
                          disabled={savingKpis}
                          onChange={(e) => {
                            const next = [...kpiConfig];
                            next[idx] = {
                              ...k,
                              enabled: e.target.checked,
                              group: k.group || KPI_GROUP_GENERAL_FA,
                              title: k.title || kpiMetricLabelFa(k.metric),
                            };
                            setKpiConfig(next);
                          }}
                        />
                        <span>
                          <strong>{k.title || kpiMetricLabelFa(k.metric)}</strong>
                          <small>{kpiMetricLabelFa(k.metric)}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={savingKpis}
                  onClick={() => void persistKpis()}
                >
                  {savingKpis ? 'در حال ذخیره…' : 'ذخیره'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={savingKpis}
                  onClick={() => setShowKpiEditor(false)}
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        )}

        {reportFormat && overview && (
          <AnalyticsReportLayoutModal
            format={reportFormat}
            overview={overview}
            neighborhoods={neighborhoods}
            points={points}
            mapCanvasDataUrl={mapSnapshot}
            producerDefault={producerDefault}
            onClose={() => setReportFormat(null)}
            onExported={(fmt) => {
              setExporting(fmt);
              window.setTimeout(() => setExporting(null), 400);
              feedback.success(
                fmt === 'pdf' ? 'پنجره چاپ/PDF با پیش‌نمایش باز شد' : `فایل ${fmt.toUpperCase()} آماده شد`,
              );
            }}
          />
        )}
      </PermissionGate>
    </AppShell>
  );
}
