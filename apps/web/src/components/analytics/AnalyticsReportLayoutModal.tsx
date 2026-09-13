'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ANALYTICS_REPORT_BUILTIN_LAYERS,
  ANALYTICS_REPORT_FONT_OPTIONS,
  AnalyticsChartMode,
  AnalyticsOverview,
  AnalyticsReportFormat,
  AnalyticsReportLayoutSettings,
  DEFAULT_ANALYTICS_REPORT_LAYOUT,
  HeatmapPoint,
  NeighborhoodChoropleth,
  ShareViewKind,
  buildShareViewPath,
  normalizeAnalyticsReportLayout,
  reportLayoutUrbanLayerIds,
  urbanReportLayerId,
} from '@city-manager/shared';
import { UrbanLayer, fetchGeoJson, fetchUrbanLayers } from '@/lib/gis-api';
import {
  ReportUrbanFeature,
  composeAnalyticsReportCsv,
  composeAnalyticsReportExcelXml,
  composeAnalyticsReportHtml,
  downloadTextFile,
  openPrintableHtml,
} from './analytics-report-compose';
import { absoluteShareUrl, createShareView } from '@/lib/share-api';
import { useFeedback } from '@/components/ui/Feedback';
import { useAuth } from '@/lib/auth';

const STORAGE_KEY = 'city-manager.analytics-report-layout';

function loadLayout(producer: string): AnalyticsReportLayoutSettings {
  const base = normalizeAnalyticsReportLayout({
    ...DEFAULT_ANALYTICS_REPORT_LAYOUT,
    producer,
  });
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    return normalizeAnalyticsReportLayout({
      ...(JSON.parse(raw) as Partial<AnalyticsReportLayoutSettings>),
      producer: producer || base.producer,
    });
  } catch {
    return base;
  }
}

const SECTION_TOGGLES: Array<[keyof AnalyticsReportLayoutSettings, string]> = [
  ['showKpis', 'شاخص‌های کلیدی'],
  ['showIncome', 'توزیع درآمد'],
  ['showEducation', 'توزیع تحصیلات'],
  ['showEmployment', 'توزیع شغل'],
  ['showOwnership', 'توزیع مالکیت'],
  ['showHouseholdTimeSeries', 'سری زمانی خانوار'],
  ['showTrajectoryTimeSeries', 'سری زمانی خط سیر'],
  ['showFilterSummary', 'خلاصه فیلتر'],
  ['showGeneratedAt', 'زمان تولید'],
  ['showProducer', 'تهیه‌کننده'],
  ['showCaption', 'زیرنویس / توضیح'],
  ['showMapInset', 'نقشه در گوشه گزارش'],
  ['showNeighborhoodLabels', 'نام محله روی نقشه'],
  ['showNeighborhoodTable', 'جدول نام محله‌ها'],
];

const CHART_MODES: Array<{ id: AnalyticsChartMode; label: string }> = [
  { id: 'none', label: 'بدون نمودار' },
  { id: 'bar', label: 'میله‌ای' },
  { id: 'pie', label: 'دایره‌ای' },
  { id: 'both', label: 'میله‌ای + دایره‌ای' },
];

export function AnalyticsReportLayoutModal({
  format,
  overview,
  neighborhoods,
  points,
  mapCanvasDataUrl,
  producerDefault,
  onClose,
  onExported,
}: {
  format: AnalyticsReportFormat;
  overview: AnalyticsOverview;
  neighborhoods: NeighborhoodChoropleth[];
  points: HeatmapPoint[];
  mapCanvasDataUrl?: string | null;
  producerDefault: string;
  onClose: () => void;
  onExported: (format: AnalyticsReportFormat) => void;
}) {
  const feedback = useFeedback();
  const { hasAnyPermission } = useAuth();
  const canShare = hasAnyPermission(['share_views:manage', 'reports:write']);
  const [layout, setLayout] = useState<AnalyticsReportLayoutSettings>(() =>
    loadLayout(producerDefault),
  );
  const [busy, setBusy] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [urbanLayers, setUrbanLayers] = useState<UrbanLayer[]>([]);
  const [urbanFeatures, setUrbanFeatures] = useState<ReportUrbanFeature[]>([]);
  const [layersLoading, setLayersLoading] = useState(false);

  useEffect(() => {
    setLayout((prev) => ({ ...prev, format, producer: prev.producer || producerDefault }));
  }, [format, producerDefault]);

  useEffect(() => {
    let cancelled = false;
    void fetchUrbanLayers().then((res) => {
      if (cancelled || !res.success || !Array.isArray(res.data)) return;
      setUrbanLayers(res.data.filter((l) => l.is_active));
    });
    return () => { cancelled = true; };
  }, []);

  const selectedUrbanIds = useMemo(
    () => reportLayoutUrbanLayerIds(layout),
    [layout.mapLayerIds],
  );

  useEffect(() => {
    if (!selectedUrbanIds.length) {
      setUrbanFeatures([]);
      return;
    }
    let cancelled = false;
    setLayersLoading(true);
    void fetchGeoJson({
      layers: 'urban',
      urbanLayerIds: selectedUrbanIds.join(','),
    }).then((fc) => {
      if (cancelled) return;
      const byId = new Map(urbanLayers.map((l) => [l.id, l]));
      const features: ReportUrbanFeature[] = (fc?.features ?? []).map((f) => {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        const layerId = String(p.layerId ?? '');
        const meta = byId.get(layerId);
        return {
          id: String(f.id ?? p.id ?? Math.random()),
          layerId,
          layerName: meta?.name || String(p.layerName ?? 'لایه شهری'),
          name: typeof p.name === 'string' ? p.name : undefined,
          colorHex: meta?.color_hex || (typeof p.colorHex === 'string' ? p.colorHex : '#1b4f72'),
          geometry: (f.geometry as Record<string, unknown>) ?? null,
        };
      });
      setUrbanFeatures(features);
      setLayersLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setUrbanFeatures([]);
        setLayersLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedUrbanIds.join(','), urbanLayers]);

  function patch<K extends keyof AnalyticsReportLayoutSettings>(key: K, value: AnalyticsReportLayoutSettings[K]) {
    setLayout((prev) => normalizeAnalyticsReportLayout({ ...prev, [key]: value }));
  }

  function toggleMapLayer(id: string, on: boolean) {
    setLayout((prev) => {
      const set = new Set(prev.mapLayerIds ?? []);
      if (on) set.add(id);
      else set.delete(id);
      const mapLayerIds = [...set];
      const next: Partial<AnalyticsReportLayoutSettings> = { ...prev, mapLayerIds };
      if (on && id === 'neighborhoods') {
        next.showNeighborhoodLabels = true;
        next.showNeighborhoodTable = true;
      }
      return normalizeAnalyticsReportLayout(next);
    });
  }

  const previewHtml = useMemo(
    () => composeAnalyticsReportHtml({
      overview,
      layout,
      neighborhoods,
      points,
      urbanFeatures,
      mapCanvasDataUrl,
      autoPrint: false,
    }),
    [overview, layout, neighborhoods, points, urbanFeatures, mapCanvasDataUrl],
  );

  function confirmExport() {
    setBusy(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
      const payload = {
        overview,
        layout,
        neighborhoods,
        points,
        urbanFeatures,
        mapCanvasDataUrl,
      };
      if (layout.format === 'pdf') {
        openPrintableHtml(composeAnalyticsReportHtml({ ...payload, autoPrint: true }));
      } else if (layout.format === 'csv') {
        downloadTextFile(
          composeAnalyticsReportCsv(overview, layout, neighborhoods),
          'analytics-report.csv',
          'text/csv;charset=utf-8',
        );
      } else {
        downloadTextFile(
          composeAnalyticsReportExcelXml(overview, layout, neighborhoods),
          'analytics-report.xls',
          'application/vnd.ms-excel',
        );
      }
      onExported(layout.format);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function createReadonlyShare() {
    setBusy(true);
    setShareLink(null);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
      const html = composeAnalyticsReportHtml({
        overview,
        layout,
        neighborhoods,
        points,
        urbanFeatures,
        mapCanvasDataUrl,
        autoPrint: false,
      });
      const layerLabels = [
        ...(layout.mapLayerIds ?? []).includes('neighborhoods') ? ['محله‌ها'] : [],
        ...(layout.mapLayerIds ?? []).includes('heat_points') ? ['نقاط آسیب‌پذیری'] : [],
        ...urbanFeatures.map((f) => f.layerName).filter(Boolean),
      ];
      const uniqueLayers = [...new Set(layerLabels)];
      const kind = mapCanvasDataUrl || uniqueLayers.length
        ? ShareViewKind.HYBRID
        : ShareViewKind.REPORT;
      const res = await createShareView({
        kind,
        title: layout.title || 'گزارش اشتراکی',
        caption: layout.caption || layout.subtitle || undefined,
        recipientLabel: layout.producer || undefined,
        expiresInDays: 7,
        snapshot: {
          kind,
          title: layout.title,
          caption: layout.caption || undefined,
          generatedAt: new Date().toISOString(),
          producer: layout.producer || producerDefault,
          organizationLabel: layout.organization || undefined,
          report: {
            sections: ['kpis', 'income', 'education', 'employment', 'ownership', 'neighborhood_table', 'map_inset'],
            html,
            title: layout.title,
            subtitle: layout.subtitle,
          },
          map: (mapCanvasDataUrl || uniqueLayers.length)
            ? {
                layerLabels: uniqueLayers.length ? uniqueLayers : ['نمای فضایی'],
                imageDataUrl: mapCanvasDataUrl || undefined,
                note: layout.mapInsetLabel || undefined,
              }
            : undefined,
        },
      });
      if (!res.success || !res.data) {
        feedback.error(res.error?.message ?? 'ساخت لینک اشتراک ناموفق بود');
        return;
      }
      const url = absoluteShareUrl(res.data.publicPath || buildShareViewPath(res.data.token));
      setShareLink(url);
      try {
        await navigator.clipboard.writeText(url);
        feedback.success('لینک فقط‌خواندنی ساخته و کپی شد');
      } catch {
        feedback.success('لینک فقط‌خواندنی ساخته شد');
      }
    } finally {
      setBusy(false);
    }
  }

  const formatLabel = layout.format === 'pdf' ? 'PDF / چاپ' : layout.format === 'excel' ? 'Excel' : 'CSV';
  const hasSpatial = neighborhoods.some((n) => n.geometry) || points.length > 0 || urbanFeatures.length > 0;
  const selectedSet = new Set(layout.mapLayerIds ?? []);

  return (
    <div className="gis-upload-modal analytics-report-modal" role="dialog" aria-modal="true" aria-labelledby="analytics-report-title">
      <div className="gis-upload-card gis-print-card analytics-report-card">
        <h3 id="analytics-report-title">چیدمان گزارش تحلیلی — {formatLabel}</h3>
        <p className="gis-panel-hint">
          لایه‌های نقشه را از فهرست موجود انتخاب کنید؛ نام محله روی نقشه و در جدول گزارش دیده می‌شود.
        </p>

        <div className="gis-print-grid analytics-report-grid">
          <div className="gis-print-fields">
            <label className="layer-style-field">
              <span>عنوان گزارش</span>
              <input value={layout.title} onChange={(e) => patch('title', e.target.value)} />
            </label>
            <label className="layer-style-field">
              <span>زیرعنوان</span>
              <input value={layout.subtitle} onChange={(e) => patch('subtitle', e.target.value)} />
            </label>
            <label className="layer-style-field gis-print-span">
              <span>زیرنویس / توضیح پویا</span>
              <textarea
                rows={2}
                value={layout.caption}
                onChange={(e) => patch('caption', e.target.value)}
                placeholder="مثلاً بازه زمانی یا توضیح محدوده مطالعه"
              />
            </label>
            <label className="layer-style-field">
              <span>تهیه‌کننده</span>
              <input value={layout.producer} onChange={(e) => patch('producer', e.target.value)} />
            </label>
            <label className="layer-style-field">
              <span>سازمان</span>
              <input value={layout.organization} onChange={(e) => patch('organization', e.target.value)} />
            </label>
            <label className="layer-style-field">
              <span>فونت فارسی</span>
              <select
                value={layout.font}
                onChange={(e) => patch('font', e.target.value as AnalyticsReportLayoutSettings['font'])}
              >
                {ANALYTICS_REPORT_FONT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="layer-style-field">
              <span>فرمت خروجی</span>
              <select
                value={layout.format}
                onChange={(e) => patch('format', e.target.value as AnalyticsReportFormat)}
              >
                <option value="pdf">PDF / چاپ (با نمودار و نقشه)</option>
                <option value="excel">Excel</option>
                <option value="csv">CSV</option>
              </select>
            </label>

            <h4 className="branding-section-title">لایه‌های نقشه گزارش</h4>
            <fieldset className="layer-style-field gis-print-span analytics-report-layer-field" disabled={!layout.showMapInset}>
              <legend>انتخاب لایه از لایه‌های موجود</legend>
              <div className="analytics-report-layer-select" role="group" aria-label="لایه‌های نقشه گزارش">
                <p className="analytics-report-layer-group-label">لایه‌های تحلیلی</p>
                {ANALYTICS_REPORT_BUILTIN_LAYERS.map((l) => (
                  <label key={l.id} className="gis-check analytics-report-layer-option">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(l.id)}
                      onChange={(e) => toggleMapLayer(l.id, e.target.checked)}
                    />
                    {l.label}
                  </label>
                ))}
                {urbanLayers.length > 0 && (
                  <>
                    <p className="analytics-report-layer-group-label">لایه‌های شهری GIS</p>
                    {urbanLayers.map((l) => {
                      const id = urbanReportLayerId(l.id);
                      return (
                        <label key={l.id} className="gis-check analytics-report-layer-option">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(id)}
                            onChange={(e) => toggleMapLayer(id, e.target.checked)}
                          />
                          {l.name}
                        </label>
                      );
                    })}
                  </>
                )}
              </div>
              <small className="muted">
                {layersLoading ? 'در حال بارگذاری لایه شهری… · ' : ''}
                {(layout.mapLayerIds?.length ?? 0) > 0
                  ? `${layout.mapLayerIds!.length} لایه انتخاب‌شده`
                  : 'هیچ لایه‌ای انتخاب نشده'}
              </small>
            </fieldset>

            <label className="layer-style-field">
              <span>گوشه نقشه در گزارش</span>
              <select
                value={layout.mapInsetCorner}
                onChange={(e) => patch('mapInsetCorner', e.target.value as AnalyticsReportLayoutSettings['mapInsetCorner'])}
                disabled={!layout.showMapInset}
              >
                <option value="top-left">بالا چپ</option>
                <option value="top-right">بالا راست</option>
                <option value="bottom-left">پایین چپ</option>
                <option value="bottom-right">پایین راست</option>
              </select>
            </label>
            <label className="layer-style-field gis-print-span">
              <span>برچسب نقشه</span>
              <input
                value={layout.mapInsetLabel}
                onChange={(e) => patch('mapInsetLabel', e.target.value)}
                disabled={!layout.showMapInset}
              />
            </label>
            {!hasSpatial && layout.showMapInset && (
              <p className="muted" style={{ margin: 0 }}>برای این فیلتر لایه مکانی فعالی نیست؛ نقشه در خروجی خالی می‌ماند.</p>
            )}

            <h4 className="branding-section-title">نمودارهای توزیع</h4>
            {(
              [
                ['incomeChart', 'درآمد'],
                ['educationChart', 'تحصیلات'],
                ['employmentChart', 'شغل'],
                ['ownershipChart', 'مالکیت'],
              ] as Array<[keyof AnalyticsReportLayoutSettings, string]>
            ).map(([key, label]) => (
              <label key={key} className="layer-style-field">
                <span>نمودار {label}</span>
                <select
                  value={String(layout[key])}
                  onChange={(e) => patch(key, e.target.value as AnalyticsChartMode)}
                >
                  {CHART_MODES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="gis-print-side">
            <div className="gis-print-preview-wrap analytics-report-preview-wrap">
              <iframe
                title="پیش‌نمایش گزارش"
                className="analytics-report-preview-frame"
                srcDoc={previewHtml}
              />
            </div>
            <div className="gis-print-toggles">
              {SECTION_TOGGLES.map(([key, label]) => (
                <label key={key} className="gis-check">
                  <input
                    type="checkbox"
                    checked={Boolean(layout[key])}
                    onChange={(e) => patch(key, e.target.checked as never)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-primary" disabled={busy || layersLoading} onClick={confirmExport}>
            {busy ? 'در حال آماده‌سازی…' : `دانلود / چاپ ${formatLabel}`}
          </button>
          {canShare && (
            <button type="button" className="btn" disabled={busy || layersLoading} onClick={() => void createReadonlyShare()}>
              اشتراک لینک فقط‌خواندنی
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>انصراف</button>
        </div>
        {shareLink && (
          <div className="share-created-banner" style={{ marginTop: '0.85rem' }}>
            <strong>لینک آماده</strong>
            <div className="int-ltr-link">
              <a className="int-ltr-link-text" href={shareLink} target="_blank" rel="noreferrer" dir="ltr">{shareLink}</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
