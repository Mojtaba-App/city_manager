/** لینک‌های فقط‌خواندنی برای اشتراک گزارش / لایه نقشه */

export enum ShareViewKind {
  REPORT = 'report',
  MAP = 'map',
  HYBRID = 'hybrid',
}

export const SHARE_VIEW_KIND_LABELS: Record<ShareViewKind, string> = {
  [ShareViewKind.REPORT]: 'گزارش تحلیلی',
  [ShareViewKind.MAP]: 'نمای نقشه / لایه',
  [ShareViewKind.HYBRID]: 'گزارش + نقشه',
};

export enum ShareViewStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export const SHARE_VIEW_STATUS_LABELS: Record<ShareViewStatus, string> = {
  [ShareViewStatus.ACTIVE]: 'فعال',
  [ShareViewStatus.REVOKED]: 'لغو شده',
  [ShareViewStatus.EXPIRED]: 'منقضی',
};

/** بخش‌های قابل اشتراک در گزارش */
export const SHARE_REPORT_SECTIONS = [
  'kpis',
  'income',
  'education',
  'employment',
  'ownership',
  'neighborhood_table',
  'map_inset',
  'caption',
] as const;

export type ShareReportSection = (typeof SHARE_REPORT_SECTIONS)[number];

export const SHARE_REPORT_SECTION_LABELS: Record<ShareReportSection, string> = {
  kpis: 'شاخص‌های کلیدی',
  income: 'توزیع درآمد',
  education: 'توزیع تحصیلات',
  employment: 'توزیع شغل',
  ownership: 'توزیع مالکیت',
  neighborhood_table: 'فهرست محله‌ها',
  map_inset: 'نقشهٔ گزارش',
  caption: 'توضیح / زیرنویس',
};

export interface ShareMapSnapshot {
  layerIds?: string[];
  layerLabels?: string[];
  bbox?: [number, number, number, number];
  /** تصویر ثابت نقشه برای نمایش فقط‌خواندنی */
  imageDataUrl?: string;
  note?: string;
  center?: { lng: number; lat: number };
  zoom?: number;
}

export interface ShareReportSnapshot {
  sections: ShareReportSection[];
  /** HTML از پیش ساخته‌شده (بدون اسکریپت چاپ اجباری) */
  html?: string;
  title?: string;
  subtitle?: string;
}

export interface ShareViewSnapshot {
  kind: ShareViewKind;
  title: string;
  caption?: string;
  generatedAt: string;
  producer?: string;
  organizationLabel?: string;
  report?: ShareReportSnapshot;
  map?: ShareMapSnapshot;
}

export interface ShareViewPublicDto {
  id: string;
  kind: ShareViewKind | string;
  title: string;
  caption?: string;
  status: ShareViewStatus | string;
  expiresAt?: string;
  viewCount: number;
  snapshot: ShareViewSnapshot;
  readOnly: true;
}

export interface ShareViewListItem {
  id: string;
  kind: string;
  title: string;
  status: string;
  tokenHint: string;
  expiresAt?: string;
  viewCount: number;
  lastViewedAt?: string;
  createdAt: string;
  publicPath: string;
}

/** مسیر عمومی سمت کلاینت */
export function buildShareViewPath(token: string): string {
  const safe = String(token || '').trim();
  return `/share/${encodeURIComponent(safe)}`;
}

export function normalizeShareReportSections(sections?: string[] | null): ShareReportSection[] {
  const allowed = new Set<string>(SHARE_REPORT_SECTIONS);
  const cleaned = [...new Set((sections ?? []).filter((s) => allowed.has(s)))] as ShareReportSection[];
  return cleaned.length ? cleaned : ['kpis', 'map_inset'];
}

export function isShareViewExpired(expiresAt?: string | Date | null, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const t = typeof expiresAt === 'string' || expiresAt instanceof Date
    ? new Date(expiresAt).getTime()
    : Number(expiresAt);
  return Number.isFinite(t) && t < now;
}

export function sanitizeShareHtml(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
}
