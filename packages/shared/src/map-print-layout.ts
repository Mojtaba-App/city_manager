/** Cartographic print layout: paper, scale, legend, and map-frame geometry */

export type PrintPaperId = 'a4' | 'a3';
export type PrintOrientation = 'landscape' | 'portrait';
export type PrintFormat = 'png' | 'pdf';
export type LegendSwatch = 'fill' | 'line' | 'point';

export interface MapPrintLayoutSettings {
  title: string;
  subtitle: string;
  description: string;
  producer: string;
  organization: string;
  disclaimer: string;
  paper: PrintPaperId;
  orientation: PrintOrientation;
  dpi: number;
  showNorthArrow: boolean;
  showScale: boolean;
  showLegend: boolean;
  showBorder: boolean;
  showNeatline: boolean;
  showExtent: boolean;
  showLogo: boolean;
  showDate: boolean;
  showCrs: boolean;
  showDisclaimer: boolean;
  showProducer: boolean;
}

export interface MapLegendItem {
  id: string;
  label: string;
  color: string;
  swatch: LegendSwatch;
}

export interface PrintBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PrintLayoutBoxes {
  page: { w: number; h: number };
  margin: number;
  title: PrintBox;
  map: PrintBox;
  legend: PrintBox | null;
  footer: PrintBox;
  logo: PrintBox | null;
}

export const PAPER_SIZE_MM: Record<PrintPaperId, { w: number; h: number }> = {
  a4: { w: 297, h: 210 },
  a3: { w: 420, h: 297 },
};

export const DEFAULT_MAP_PRINT_LAYOUT: MapPrintLayoutSettings = {
  title: 'نقشه بازآفرینی شهری',
  subtitle: '',
  description: '',
  producer: '',
  organization: '',
  disclaimer: 'این نقشه جنبه اطلاع‌رسانی دارد و مبنای حقوقی تفکیک نیست.',
  paper: 'a4',
  orientation: 'landscape',
  dpi: 150,
  showNorthArrow: true,
  showScale: true,
  showLegend: true,
  showBorder: true,
  showNeatline: true,
  showExtent: true,
  showLogo: true,
  showDate: true,
  showCrs: true,
  showDisclaimer: true,
  showProducer: true,
};

export function paperSizePx(
  paper: PrintPaperId,
  orientation: PrintOrientation,
  dpi: number,
): { width: number; height: number; widthMm: number; heightMm: number } {
  const safeDpi = Math.min(300, Math.max(72, dpi || 150));
  const base = PAPER_SIZE_MM[paper] ?? PAPER_SIZE_MM.a4;
  const widthMm = orientation === 'portrait' ? base.h : base.w;
  const heightMm = orientation === 'portrait' ? base.w : base.h;
  return {
    width: Math.round((widthMm / 25.4) * safeDpi),
    height: Math.round((heightMm / 25.4) * safeDpi),
    widthMm,
    heightMm,
  };
}

export function computePrintLayoutBoxes(
  settings: Pick<MapPrintLayoutSettings, 'showLegend' | 'showLogo' | 'dpi'>,
  pageW: number,
  pageH: number,
): PrintLayoutBoxes {
  const margin = Math.max(18, Math.round(pageW * 0.028));
  const titleH = Math.max(44, Math.round(pageH * 0.08));
  const footerH = Math.max(56, Math.round(pageH * 0.11));
  const legendW = settings.showLegend ? Math.max(140, Math.round(pageW * 0.18)) : 0;
  const gap = Math.max(8, Math.round(pageW * 0.01));
  const innerW = pageW - margin * 2;
  const mapW = innerW - (legendW ? legendW + gap : 0);
  const mapH = pageH - margin * 2 - titleH - footerH - gap * 2;
  const mapX = margin;
  const mapY = margin + titleH + gap;
  const logoSize = settings.showLogo ? Math.min(72, Math.round(footerH * 0.85)) : 0;

  return {
    page: { w: pageW, h: pageH },
    margin,
    title: { x: margin, y: margin, w: innerW, h: titleH },
    map: { x: mapX, y: mapY, w: mapW, h: Math.max(80, mapH) },
    legend: settings.showLegend
      ? { x: mapX + mapW + gap, y: mapY, w: legendW, h: Math.max(80, mapH) }
      : null,
    footer: { x: margin, y: pageH - margin - footerH, w: innerW, h: footerH },
    logo: settings.showLogo
      ? { x: pageW - margin - logoSize, y: pageH - margin - logoSize, w: logoSize, h: logoSize }
      : null,
  };
}

/** Web-Mercator meters per pixel at a latitude and zoom. */
export function metersPerPixel(latitude: number, zoom: number): number {
  const lat = Math.max(-85, Math.min(85, latitude));
  const z = Math.max(0, zoom);
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

export function niceScaleMeters(targetMeters: number): number {
  if (!Number.isFinite(targetMeters) || targetMeters <= 0) return 100;
  const mag = 10 ** Math.floor(Math.log10(targetMeters));
  const n = targetMeters / mag;
  const nice = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  return nice * mag;
}

/** Ground meters represented by one pixel of the composed map frame. */
export function mapFrameMetersPerPixel(opts: {
  latitude: number;
  zoom: number;
  sourceWidthPx: number;
  drawnWidthPx: number;
}): number {
  const srcMpp = metersPerPixel(opts.latitude, opts.zoom);
  if (opts.drawnWidthPx <= 0) return srcMpp;
  return srcMpp * (opts.sourceWidthPx / opts.drawnWidthPx);
}

export function formatScaleRatio(groundMeters: number, paperMeters: number): string {
  if (!Number.isFinite(groundMeters) || !Number.isFinite(paperMeters) || paperMeters <= 0) {
    return '—';
  }
  const ratio = Math.max(1, Math.round(groundMeters / paperMeters));
  return `1:${ratio.toLocaleString('en-US')}`;
}

export function formatMapExtent(b: { west: number; south: number; east: number; north: number }): string {
  const fmt = (n: number) => n.toFixed(4);
  return `W ${fmt(b.west)}°  S ${fmt(b.south)}°  E ${fmt(b.east)}°  N ${fmt(b.north)}°`;
}

export function formatScaleBarLabel(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toLocaleString('fa-IR')} کیلومتر`;
  return `${meters.toLocaleString('fa-IR')} متر`;
}

export function buildMapLegendItems(input: {
  neighborhoodsOn: boolean;
  fabricsOn: boolean;
  dwellingsOn: boolean;
  urbanOn: boolean;
  fabricTypes: Array<{ id: string; name: string; colorHex: string }>;
  selectedFabricTypeIds: string[];
  urbanLayers: Array<{ id: string; name: string; colorHex: string; isActive?: boolean; visible?: boolean }>;
}): MapLegendItem[] {
  const items: MapLegendItem[] = [];
  if (input.neighborhoodsOn) {
    items.push({ id: 'neighborhoods', label: 'محلات هدف', color: '#1a5276', swatch: 'fill' });
  }
  if (input.fabricsOn) {
    const selected = new Set(input.selectedFabricTypeIds);
    const types = input.fabricTypes.filter((t) => selected.size === 0 || selected.has(t.id));
    if (types.length === 0) {
      items.push({ id: 'fabrics', label: 'بافت‌ها', color: '#d4a017', swatch: 'fill' });
    } else {
      for (const t of types) {
        items.push({ id: `ft:${t.id}`, label: t.name, color: t.colorHex || '#d4a017', swatch: 'fill' });
      }
    }
  }
  if (input.dwellingsOn) {
    items.push({ id: 'dwellings', label: 'املاک / منازل', color: '#c0392b', swatch: 'point' });
  }
  if (input.urbanOn) {
    for (const layer of input.urbanLayers) {
      if (layer.isActive === false || layer.visible === false) continue;
      items.push({ id: `ul:${layer.id}`, label: layer.name, color: layer.colorHex || '#2e86ab', swatch: 'line' });
    }
  }
  return items;
}
