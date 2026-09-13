import {
  AnalyticsChartMode,
  AnalyticsOverview,
  AnalyticsReportLayoutSettings,
  DistributionBucket,
  HeatmapPoint,
  NeighborhoodChoropleth,
  TimeSeriesPoint,
  analyticsReportFontCss,
  describeAnalyticsFilter,
  formatNeighborhoodAreaFa,
  neighborhoodAreaSqmValue,
  reportLayoutHasHeatPoints,
  reportLayoutHasNeighborhoods,
} from '@city-manager/shared';

const CHART_COLORS = ['#0f4c5c', '#c46b2b', '#175cd3', '#0f7a4c', '#b54708', '#6941c6', '#dd2590', '#5b6b7a'];

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function faNum(n: number): string {
  try {
    return new Intl.NumberFormat('fa-IR').format(n);
  } catch {
    return String(n);
  }
}

function activeBuckets(data: DistributionBucket[]) {
  return data.filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
}

export function buildBarChartSvg(data: DistributionBucket[], width = 420, height = 180): string {
  const items = activeBuckets(data).slice(0, 8);
  if (!items.length) return '<p class="muted">نمودار میله‌ای: بدون داده</p>';
  const max = Math.max(...items.map((d) => d.count), 1);
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 36;
  const gap = 8;
  const barW = (width - padL - padR - gap * (items.length - 1)) / items.length;
  const bars = items.map((d, i) => {
    const h = ((d.count / max) * (height - padT - padB)) || 1;
    const x = padL + i * (barW + gap);
    const y = height - padB - h;
    const label = d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label;
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${CHART_COLORS[i % CHART_COLORS.length]}" />
      <text x="${x + barW / 2}" y="${height - 18}" text-anchor="middle" font-size="9" fill="#5b6b7a">${esc(label)}</text>
      <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="#15202b">${esc(faNum(d.count))}</text>
    `;
  }).join('');
  return `<svg class="report-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="نمودار میله‌ای">${bars}</svg>`;
}

export function buildPieChartSvg(data: DistributionBucket[], size = 170): string {
  const items = activeBuckets(data).slice(0, 8);
  if (!items.length) return '<p class="muted">نمودار دایره‌ای: بدون داده</p>';
  const total = items.reduce((s, d) => s + d.count, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;
  let angle = -Math.PI / 2;
  const slices = items.map((d, i) => {
    const slice = (d.count / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += slice;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return `<path d="${path}" fill="${CHART_COLORS[i % CHART_COLORS.length]}" stroke="#fff" stroke-width="1" />`;
  }).join('');
  const legend = items.map((d, i) => `
    <li><i style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></i>${esc(d.label)} — ${esc(faNum(d.percent))}٪</li>
  `).join('');
  return `
    <div class="pie-wrap">
      <svg class="report-chart pie" viewBox="0 0 ${size} ${size}" role="img" aria-label="نمودار دایره‌ای">${slices}</svg>
      <ul class="pie-legend">${legend}</ul>
    </div>`;
}

function chartsFor(mode: AnalyticsChartMode, data: DistributionBucket[]): string {
  if (mode === 'none') return '';
  const parts: string[] = [];
  if (mode === 'bar' || mode === 'both') parts.push(`<div class="chart-block">${buildBarChartSvg(data)}</div>`);
  if (mode === 'pie' || mode === 'both') parts.push(`<div class="chart-block">${buildPieChartSvg(data)}</div>`);
  return `<div class="charts-row">${parts.join('')}</div>`;
}

function distTable(title: string, buckets: DistributionBucket[]): string {
  const rows = activeBuckets(buckets);
  if (!rows.length) {
    return `<section class="report-section"><h3>${esc(title)}</h3><p class="muted">داده‌ای نیست</p></section>`;
  }
  return `
    <section class="report-section">
      <h3>${esc(title)}</h3>
      <table>
        <thead><tr><th>دسته</th><th>تعداد</th><th>درصد</th></tr></thead>
        <tbody>
          ${rows.map((b) => `<tr><td>${esc(b.label)}</td><td>${esc(faNum(b.count))}</td><td>${esc(faNum(b.percent))}٪</td></tr>`).join('')}
        </tbody>
      </table>
    </section>`;
}

function timeSeriesTable(title: string, series: TimeSeriesPoint[]): string {
  if (!series.length) {
    return `<section class="report-section"><h3>${esc(title)}</h3><p class="muted">سری زمانی خالی است</p></section>`;
  }
  return `
    <section class="report-section">
      <h3>${esc(title)}</h3>
      <table>
        <thead><tr><th>دوره</th><th>مقدار</th></tr></thead>
        <tbody>
          ${series.map((p) => `<tr><td>${esc(p.label || p.period)}</td><td>${esc(faNum(p.value))}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>`;
}

function projectRing(ring: number[][], bbox: { minX: number; minY: number; maxX: number; maxY: number }, w: number, h: number, pad = 8): string {
  const dx = Math.max(bbox.maxX - bbox.minX, 1e-9);
  const dy = Math.max(bbox.maxY - bbox.minY, 1e-9);
  return ring.map(([lon, lat], i) => {
    const x = pad + ((lon - bbox.minX) / dx) * (w - pad * 2);
    const y = pad + (1 - (lat - bbox.minY) / dy) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z';
}

function collectCoords(geom: Record<string, unknown> | null | undefined, out: number[][]) {
  if (!geom) return;
  const coords = geom.coordinates as unknown;
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      out.push([c[0] as number, c[1] as number]);
      return;
    }
    for (const x of c) walk(x);
  };
  walk(coords);
}

function ringCentroid(ring: number[][]): [number, number] | null {
  if (!ring?.length) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    sx += Number(pt[0]);
    sy += Number(pt[1]);
    n += 1;
  }
  if (!n) return null;
  return [sx / n, sy / n];
}

function projectPoint(
  lon: number,
  lat: number,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  w: number,
  h: number,
  pad = 8,
): [number, number] {
  const dx = Math.max(bbox.maxX - bbox.minX, 1e-9);
  const dy = Math.max(bbox.maxY - bbox.minY, 1e-9);
  const x = pad + ((lon - bbox.minX) / dx) * (w - pad * 2);
  const y = pad + (1 - (lat - bbox.minY) / dy) * (h - pad * 2);
  return [x, y];
}

export type ReportUrbanFeature = {
  id: string;
  layerId: string;
  layerName: string;
  name?: string;
  colorHex?: string;
  geometry: Record<string, unknown> | null;
};

export function buildSpatialInsetSvg(
  neighborhoods: NeighborhoodChoropleth[],
  points: HeatmapPoint[],
  opts: {
    showNeighborhoods: boolean;
    showHeat: boolean;
    showLabels?: boolean;
    urbanFeatures?: ReportUrbanFeature[];
    width?: number;
    height?: number;
  },
): string {
  const w = opts.width ?? 320;
  const h = opts.height ?? 240;
  const polys = opts.showNeighborhoods
    ? neighborhoods.filter((n) => n.geometry)
    : [];
  const heats = opts.showHeat ? points.filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat)) : [];
  const urban = (opts.urbanFeatures ?? []).filter((f) => f.geometry);

  const all: number[][] = [];
  for (const n of polys) collectCoords(n.geometry as Record<string, unknown>, all);
  for (const u of urban) collectCoords(u.geometry, all);
  for (const p of heats) all.push([p.lng, p.lat]);
  if (!all.length) {
    return '<p class="muted">لایه مکانی برای این فیلتر در دسترس نیست</p>';
  }

  const bbox = {
    minX: Math.min(...all.map((c) => c[0])),
    maxX: Math.max(...all.map((c) => c[0])),
    minY: Math.min(...all.map((c) => c[1])),
    maxY: Math.max(...all.map((c) => c[1])),
  };

  const extractRings = (g: Record<string, unknown> | null | undefined): number[][][] => {
    if (!g) return [];
    const type = String(g.type ?? '');
    const coords = g.coordinates;
    if (type === 'Polygon' && Array.isArray(coords)) return coords as number[][][];
    if (type === 'MultiPolygon' && Array.isArray(coords)) {
      return (coords as number[][][][]).flatMap((poly) => poly);
    }
    return [];
  };

  const urbanPaths = urban.map((f) => {
    const rings = extractRings(f.geometry);
    const d = rings
      .filter((ring) => Array.isArray(ring) && ring.length >= 3)
      .map((ring) => projectRing(ring, bbox, w, h))
      .join(' ');
    if (!d) return '';
    const fill = f.colorHex || '#1b4f72';
    return `<path d="${d}" fill="${fill}" fill-opacity="0.28" stroke="${fill}" stroke-width="1"><title>${esc(f.name || f.layerName)}</title></path>`;
  }).join('');

  const polyPaths = polys.map((n) => {
    const rings = extractRings(n.geometry as Record<string, unknown>);
    const d = rings
      .filter((ring) => Array.isArray(ring) && ring.length >= 3)
      .map((ring) => projectRing(ring, bbox, w, h))
      .join(' ');
    if (!d) return '';
    const vuln = Number(n.avgVulnerability ?? 0);
    const fill = vuln >= 7 ? '#d00000' : vuln >= 4 ? '#fde725' : '#9fd3c7';
    return `<path d="${d}" fill="${fill}" fill-opacity="0.45" stroke="#0f4c5c" stroke-width="1.2"><title>${esc(n.name)} — خانوار ${faNum(n.householdCount)}</title></path>`;
  }).join('');

  const labels = opts.showLabels
    ? polys.map((n) => {
      const rings = extractRings(n.geometry as Record<string, unknown>);
      const outer = rings[0];
      const c = outer ? ringCentroid(outer) : null;
      if (!c) return '';
      const [x, y] = projectPoint(c[0], c[1], bbox, w, h);
      const label = (n.name || n.code || 'محله').trim();
      if (!label) return '';
      const short = label.length > 16 ? `${label.slice(0, 15)}…` : label;
      const boxW = Math.max(36, short.length * 7.2 + 10);
      return `
        <g class="nbhd-label">
          <rect x="${(x - boxW / 2).toFixed(1)}" y="${(y - 10).toFixed(1)}" width="${boxW.toFixed(1)}" height="16" rx="4" fill="#ffffff" fill-opacity="0.96" stroke="#0f4c5c" stroke-width="0.8" />
          <text x="${x.toFixed(1)}" y="${(y + 2.5).toFixed(1)}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" font-family="Vazirmatn, Tahoma, sans-serif" font-size="11" font-weight="800" fill="#0f4c5c">${esc(short)}</text>
        </g>
      `;
    }).join('')
    : '';

  const dots = heats.slice(0, 800).map((p) => {
    const [x, y] = projectPoint(p.lng, p.lat, bbox, w, h);
    const r = 2 + Math.min(4, (p.weight || 1) / 3);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#c46b2b" fill-opacity="0.75" />`;
  }).join('');

  return `
    <svg class="map-inset" viewBox="0 0 ${w} ${h}" role="img" aria-label="نمای فضایی">
      <rect width="${w}" height="${h}" fill="#f4f7f9" rx="8" />
      ${urbanPaths}
      ${polyPaths}
      ${dots}
      ${labels}
    </svg>`;
}

export type ComposeAnalyticsReportInput = {
  overview: AnalyticsOverview;
  layout: AnalyticsReportLayoutSettings;
  neighborhoods?: NeighborhoodChoropleth[];
  points?: HeatmapPoint[];
  urbanFeatures?: ReportUrbanFeature[];
  mapCanvasDataUrl?: string | null;
  autoPrint?: boolean;
};

function neighborhoodTableHtml(neighborhoods: NeighborhoodChoropleth[]): string {
  const rows = neighborhoods
    .filter((n) => (n.name || n.code || '').trim())
    .sort((a, b) => (a.name || a.code || '').localeCompare(b.name || b.code || '', 'fa'));
  if (!rows.length) {
    return `<section class="report-section"><h3>فهرست محله‌ها</h3><p class="muted">محله‌ای برای نمایش نیست</p></section>`;
  }
  return `
    <section class="report-section">
      <h3>فهرست محله‌ها</h3>
      <table>
        <thead><tr><th>نام محله</th><th>کد</th><th>خانوار</th><th>جمعیت</th><th>مساحت</th><th>آسیب‌پذیری</th></tr></thead>
        <tbody>
          ${rows.map((n) => `
            <tr>
              <td><strong>${esc((n.name || n.code || 'محله').trim())}</strong></td>
              <td>${esc(n.code ?? '—')}</td>
              <td>${esc(faNum(n.householdCount ?? 0))}</td>
              <td>${n.population != null ? esc(faNum(n.population)) : '—'}</td>
              <td>${esc(formatNeighborhoodAreaFa(n.areaSqm, faNum))}</td>
              <td>${n.avgVulnerability != null ? esc(faNum(Math.round(n.avgVulnerability * 10) / 10)) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </section>`;
}

export function composeAnalyticsReportHtml(input: ComposeAnalyticsReportInput): string {
  const { overview, layout, autoPrint } = input;
  const font = analyticsReportFontCss(layout.font);
  const neighborhoods = input.neighborhoods ?? [];
  const points = input.points ?? [];
  const urbanFeatures = input.urbanFeatures ?? [];
  const showNbhd = reportLayoutHasNeighborhoods(layout);
  const showHeat = reportLayoutHasHeatPoints(layout);
  const hasSpatial =
    (showNbhd && neighborhoods.some((n) => n.geometry))
    || (showHeat && points.length > 0)
    || urbanFeatures.some((f) => f.geometry);

  const sections: string[] = [];

  if (layout.showKpis) {
    const kpis = overview.kpis ?? [];
    sections.push(`
      <section class="report-section">
        <h3>شاخص‌های کلیدی</h3>
        <table>
          <thead><tr><th>شاخص</th><th>مقدار</th></tr></thead>
          <tbody>
            ${kpis.map((k) => `<tr><td>${esc(k.title)}</td><td>${esc(k.value)}${k.unit ? ` ${esc(k.unit)}` : ''}</td></tr>`).join('')}
          </tbody>
        </table>
      </section>`);
  }

  // Neighborhood names early so they are never hidden under the map inset.
  if (layout.showMapInset && layout.showNeighborhoodTable !== false && showNbhd) {
    sections.push(neighborhoodTableHtml(neighborhoods));
  }

  const pushDist = (
    enabled: boolean,
    title: string,
    buckets: DistributionBucket[],
    chartMode: AnalyticsChartMode,
  ) => {
    if (!enabled) return;
    sections.push(distTable(title, buckets));
    const charts = chartsFor(chartMode, buckets);
    if (charts) sections.push(charts);
  };

  pushDist(layout.showIncome, 'توزیع درآمد', overview.distributions.income, layout.incomeChart);
  pushDist(layout.showEducation, 'توزیع تحصیلات', overview.distributions.education, layout.educationChart);
  pushDist(layout.showEmployment, 'توزیع شغل / اشتغال', overview.distributions.employment, layout.employmentChart);
  pushDist(layout.showOwnership, 'توزیع مالکیت', overview.distributions.ownership, layout.ownershipChart);

  if (layout.showHouseholdTimeSeries) {
    sections.push(timeSeriesTable('سری زمانی — ثبت خانوار', overview.timeSeries.householdsRegistered));
  }
  if (layout.showTrajectoryTimeSeries) {
    sections.push(timeSeriesTable('سری زمانی — رویداد خط سیر', overview.timeSeries.trajectoryEvents));
  }

  let mapBlock = '';
  if (layout.showMapInset && hasSpatial) {
    const corner = layout.mapInsetCorner;
    const showLabels = layout.showNeighborhoodLabels !== false && showNbhd;
    const svg = buildSpatialInsetSvg(neighborhoods, points, {
      showNeighborhoods: showNbhd,
      showHeat,
      showLabels,
      urbanFeatures,
    });
    // Prefer labeled SVG for print clarity; optional raster as secondary when available.
    const raster = input.mapCanvasDataUrl && !showNbhd
      ? `<img class="map-raster" src="${input.mapCanvasDataUrl}" alt="نقشه" />`
      : '';
    const named = neighborhoods.filter((n) => (n.name || n.code || '').trim());
    const nameChips = showLabels && named.length
      ? `<ul class="nbhd-chips">${named
          .slice(0, 36)
          .map((n) => `<li>${esc((n.name || n.code || '').trim())}</li>`)
          .join('')}</ul>`
      : '';
    mapBlock = `
      <aside class="map-inset-box corner-${corner}">
        <h4>${esc(layout.mapInsetLabel || 'نمای فضایی')}</h4>
        ${svg}
        ${raster}
        ${nameChips}
        ${showLabels ? '<p class="map-caption muted">نام محله‌ها روی نقشه و در جدول گزارش</p>' : ''}
      </aside>`;
  }
  const mapFirst = !layout.mapInsetCorner.startsWith('bottom');

  const metaBits: string[] = [];
  if (layout.showGeneratedAt) {
    metaBits.push(`زمان تولید: ${esc(new Date(overview.generatedAt).toLocaleString('fa-IR'))}`);
  }
  if (layout.showFilterSummary) {
    metaBits.push(`فیلتر: ${esc(describeAnalyticsFilter(overview.filters ?? {}))}`);
  }
  if (layout.showProducer && layout.producer.trim()) {
    metaBits.push(`تهیه‌کننده: ${esc(layout.producer.trim())}`);
  }
  if (layout.organization.trim()) {
    metaBits.push(`سازمان: ${esc(layout.organization.trim())}`);
  }

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${esc(layout.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800&display=swap"/>
<style>
  :root { --ink:#15202b; --brand:#0f4c5c; --muted:#5b6b7a; --line:#d7e0e7; --soft:#e6f1f4; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px;
    color: var(--ink);
    font-family: ${font};
    font-size: 13px;
    line-height: 1.7;
    background: #fff;
  }
  h1 { color: var(--brand); font-size: 1.45rem; margin: 0 0 0.25rem; font-weight: 800; }
  .subtitle { color: var(--muted); margin: 0 0 0.75rem; font-size: 0.95rem; }
  .caption { color: var(--ink); margin: 0 0 1rem; font-size: 0.88rem; }
  .meta { color: var(--muted); font-size: 0.8rem; margin-bottom: 0.35rem; }
  h3 { color: var(--brand); margin: 1.35rem 0 0.55rem; font-size: 1.05rem; }
  h4 { margin: 0 0 0.45rem; color: var(--brand); font-size: 0.85rem; }
  table { width: 100%; border-collapse: collapse; margin: 0.35rem 0 0.75rem; font-size: 0.82rem; }
  th, td { border: 1px solid var(--line); padding: 0.45rem 0.55rem; text-align: right; }
  th { background: var(--soft); }
  .muted { color: var(--muted); }
  .report-shell {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-start;
    min-height: 20vh;
  }
  .charts-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-start; margin: 0.35rem 0 1rem; }
  .chart-block { flex: 1 1 220px; min-width: 200px; max-width: 100%; }
  .report-chart { width: 100%; height: auto; display: block; }
  .pie-wrap { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
  .pie-legend { list-style: none; margin: 0; padding: 0; font-size: 0.75rem; }
  .pie-legend li { display: flex; align-items: center; gap: 0.35rem; margin: 0.2rem 0; }
  .pie-legend i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  .map-inset-box {
    position: relative;
    width: min(360px, 100%);
    flex: 0 1 360px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 0.65rem;
    box-shadow: 0 8px 24px rgba(15, 76, 92, 0.12);
  }
  .map-inset-box.corner-top-left,
  .map-inset-box.corner-bottom-left { order: 0; }
  .map-inset-box.corner-top-right,
  .map-inset-box.corner-bottom-right { order: 2; margin-inline-start: auto; }
  .map-inset, .map-raster { width: 100%; height: auto; border-radius: 8px; display: block; }
  .map-raster { margin-top: 0.35rem; }
  .map-caption { margin: 0.35rem 0 0; font-size: 0.72rem; }
  .nbhd-label text { paint-order: stroke fill; stroke: #fff; stroke-width: 2.5px; }
  .nbhd-chips {
    list-style: none; margin: 0.45rem 0 0; padding: 0;
    display: flex; flex-wrap: wrap; gap: 0.3rem;
  }
  .nbhd-chips li {
    font-size: 0.72rem; font-weight: 700; color: var(--brand);
    background: var(--soft); border: 1px solid var(--line);
    border-radius: 6px; padding: 0.15rem 0.5rem;
  }
  .report-main { flex: 1 1 280px; min-width: 0; order: 1; }
  @media print {
    body { padding: 12px; }
    .map-inset-box { box-shadow: none; break-inside: avoid; }
    .report-section, .charts-row { break-inside: avoid; }
  }
</style>
</head>
<body>
  <header>
    <h1>${esc(layout.title)}</h1>
    ${layout.subtitle ? `<p class="subtitle">${esc(layout.subtitle)}</p>` : ''}
    ${layout.showCaption && layout.caption.trim() ? `<p class="caption">${esc(layout.caption.trim())}</p>` : ''}
    ${metaBits.map((m) => `<div class="meta">${m}</div>`).join('')}
  </header>
  <div class="report-shell">
    ${mapFirst ? mapBlock : ''}
    <div class="report-main">
      ${sections.join('\n')}
    </div>
    ${!mapFirst ? mapBlock : ''}
  </div>
  ${autoPrint ? '<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>' : ''}
</body>
</html>`;
}

export function composeAnalyticsReportCsv(
  overview: AnalyticsOverview,
  layout: AnalyticsReportLayoutSettings,
  neighborhoods: NeighborhoodChoropleth[] = [],
): string {
  const lines: string[] = ['\uFEFF' + layout.title];
  if (layout.subtitle) lines.push(layout.subtitle);
  if (layout.showGeneratedAt) lines.push(`زمان تولید,${overview.generatedAt}`);
  if (layout.showFilterSummary) lines.push(`فیلتر,${describeAnalyticsFilter(overview.filters ?? {})}`);
  if (layout.showProducer && layout.producer) lines.push(`تهیه‌کننده,${layout.producer}`);
  lines.push('');

  if (layout.showKpis) {
    lines.push('شاخص‌های کلیدی');
    lines.push('عنوان,مقدار,واحد');
    for (const k of overview.kpis) {
      lines.push([k.title, String(k.value), k.unit ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }
    lines.push('');
  }

  const pushDist = (on: boolean, name: string, buckets: DistributionBucket[]) => {
    if (!on) return;
    lines.push(name);
    lines.push('دسته,تعداد,درصد');
    for (const b of activeBuckets(buckets)) {
      lines.push([b.label, String(b.count), String(b.percent)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }
    lines.push('');
  };
  pushDist(layout.showIncome, 'توزیع درآمد', overview.distributions.income);
  pushDist(layout.showEducation, 'توزیع تحصیلات', overview.distributions.education);
  pushDist(layout.showEmployment, 'توزیع شغل', overview.distributions.employment);
  pushDist(layout.showOwnership, 'توزیع مالکیت', overview.distributions.ownership);

  if (layout.showMapInset && layout.showNeighborhoodTable !== false && reportLayoutHasNeighborhoods(layout)) {
    lines.push('فهرست محله‌ها');
    lines.push('نام محله,کد,خانوار,جمعیت,مساحت (م²),آسیب‌پذیری');
    for (const n of neighborhoods
      .filter((x) => (x.name || x.code || '').trim())
      .sort((a, b) => (a.name || a.code || '').localeCompare(b.name || b.code || '', 'fa'))) {
      const area = neighborhoodAreaSqmValue(n.areaSqm);
      lines.push([
        n.name || n.code || 'محله',
        n.code ?? '',
        String(n.householdCount ?? 0),
        n.population != null ? String(n.population) : '',
        area != null ? String(area) : '',
        n.avgVulnerability != null ? String(n.avgVulnerability) : '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }
    lines.push('');
  }

  if (layout.showHouseholdTimeSeries) {
    lines.push('سری زمانی ثبت خانوار');
    lines.push('دوره,مقدار');
    for (const p of overview.timeSeries.householdsRegistered) {
      lines.push(`"${p.period}",${p.value}`);
    }
    lines.push('');
  }
  if (layout.showTrajectoryTimeSeries) {
    lines.push('سری زمانی رویداد خط سیر');
    lines.push('دوره,مقدار');
    for (const p of overview.timeSeries.trajectoryEvents) {
      lines.push(`"${p.period}",${p.value}`);
    }
  }
  return lines.join('\n');
}

export function composeAnalyticsReportExcelXml(
  overview: AnalyticsOverview,
  layout: AnalyticsReportLayoutSettings,
  neighborhoods: NeighborhoodChoropleth[] = [],
): string {
  const rows: string[] = [];
  const cell = (v: string, type: 'String' | 'Number' = 'String') =>
    `<Cell><Data ss:Type="${type}">${esc(v)}</Data></Cell>`;
  const add = (cells: string[]) => rows.push(`<Row>${cells.join('')}</Row>`);

  add([cell(layout.title)]);
  if (layout.subtitle) add([cell(layout.subtitle)]);
  if (layout.showGeneratedAt) add([cell(`تولید: ${overview.generatedAt}`)]);
  if (layout.showFilterSummary) add([cell(`فیلتر: ${describeAnalyticsFilter(overview.filters ?? {})}`)]);
  add([cell('')]);

  if (layout.showKpis) {
    add([cell('شاخص'), cell('مقدار')]);
    for (const k of overview.kpis) add([cell(k.title), cell(String(k.value))]);
    add([cell('')]);
  }

  const pushDist = (on: boolean, name: string, buckets: DistributionBucket[]) => {
    if (!on) return;
    add([cell(name), cell('تعداد'), cell('درصد')]);
    for (const b of activeBuckets(buckets)) {
      add([cell(b.label), cell(String(b.count), 'Number'), cell(String(b.percent), 'Number')]);
    }
    add([cell('')]);
  };
  pushDist(layout.showIncome, 'درآمد', overview.distributions.income);
  pushDist(layout.showEducation, 'تحصیلات', overview.distributions.education);
  pushDist(layout.showEmployment, 'شغل', overview.distributions.employment);
  pushDist(layout.showOwnership, 'مالکیت', overview.distributions.ownership);

  if (layout.showMapInset && layout.showNeighborhoodTable !== false && reportLayoutHasNeighborhoods(layout)) {
    add([cell('فهرست محله‌ها')]);
    add([cell('نام محله'), cell('کد'), cell('خانوار'), cell('جمعیت'), cell('مساحت (م²)'), cell('آسیب‌پذیری')]);
    for (const n of neighborhoods
      .filter((x) => (x.name || x.code || '').trim())
      .sort((a, b) => (a.name || a.code || '').localeCompare(b.name || b.code || '', 'fa'))) {
      const area = neighborhoodAreaSqmValue(n.areaSqm);
      add([
        cell(n.name || n.code || 'محله'),
        cell(n.code ?? ''),
        cell(String(n.householdCount ?? 0), 'Number'),
        cell(n.population != null ? String(n.population) : ''),
        area != null ? cell(String(area), 'Number') : cell(''),
        cell(n.avgVulnerability != null ? String(n.avgVulnerability) : ''),
      ]);
    }
    add([cell('')]);
  }

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Analytics">
  <Table>
   ${rows.join('\n')}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function openPrintableHtml(html: string) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('پنجره گزارش مسدود شد — اجازه پاپ‌آپ را فعال کنید');
  w.document.write(html);
  w.document.close();
}
