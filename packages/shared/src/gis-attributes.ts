/** Flatten GIS feature attributes (KML balloons, ExtendedData, shapefile fields) for popup display. */

const INTERNAL_KEYS = new Set([
  'geometry',
  'geom',
  'coordinates',
  'fill',
  'stroke',
  'fill-opacity',
  'stroke-opacity',
  'stroke-width',
  'fillopacity',
  'strokeopacity',
  'styleurl',
  'visibility',
  'open',
  'tessellate',
  'extrude',
  'altitudemode',
  'icon',
  'shape',
  'shape_length',
  'shape_area',
  'shape_leng',
  'objectid',
  'fid',
  'oid',
  'globalid',
  'oid_',
]);

const ATTR_LABELS: Record<string, string> = {
  karbari: 'کاربری',
  landuse: 'کاربری',
  land_use: 'کاربری',
  lu: 'کاربری',
  lu_type: 'نوع کاربری',
  lu_code: 'کد کاربری',
  lu_name: 'نام کاربری',
  type: 'نوع',
  zone: 'پهنه',
  density: 'تراکم',
  floors: 'طبقات',
  far: 'سطح اشغال',
  area: 'مساحت',
  area_m2: 'مساحت (م²)',
  area_sqm: 'مساحت (م²)',
  description: 'توضیحات',
  desc: 'توضیحات',
  name_fa: 'نام',
  nam: 'نام',
  code: 'کد',
  remark: 'توضیح',
  remarks: 'توضیح',
  note: 'یادداشت',
  notes: 'یادداشت',
  parcel: 'قطعه',
  plaque: 'پلاک',
  address: 'آدرس',
  district: 'منطقه',
  region: 'ناحیه',
};

export interface GisAttributeRow {
  key: string;
  label: string;
  value: string;
}

function normKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function isInternalGisAttributeKey(key: string): boolean {
  const n = normKey(key);
  return INTERNAL_KEYS.has(n);
}

export function gisAttributeLabel(key: string): string {
  const n = normKey(key);
  return ATTR_LABELS[n] ?? key.replace(/_/g, ' ').trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function stripHtmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n')
    .replace(/<\s*\/\s*tr\s*>/gi, '\n')
    .replace(/<\s*\/\s*div\s*>/gi, '\n');
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** ArcGIS / Google Earth balloon tables: two-cell rows → field map. */
export function parseHtmlAttributeTable(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const rows = html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      stripHtmlToText(m[1]),
    );
    if (cells.length !== 2) continue;
    const [key, value] = cells;
    if (!key || !value || isInternalGisAttributeKey(key)) continue;
    if (normKey(key) === normKey(value)) continue;
    if (!(key in out)) out[key] = value;
  }
  return out;
}

function htmlPayload(value: unknown): string | null {
  if (typeof value === 'string' && looksLikeHtml(value)) return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (o['@type'] === 'html' && typeof o.value === 'string') return o.value;
  }
  return null;
}

function scalarText(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? t : null;
  }
  return null;
}

function fromNestedObject(value: Record<string, unknown>): unknown {
  if (typeof value.value === 'string' || typeof value.value === 'number' || typeof value.value === 'boolean') {
    return value.value;
  }
  return value;
}

const MAX_VALUE_LEN = 4_000;

function clip(text: string): string {
  if (text.length <= MAX_VALUE_LEN) return text;
  return `${text.slice(0, MAX_VALUE_LEN).trim()}…`;
}

/**
 * Turn messy KML/shapefile properties into a flat map of popup fields.
 * Does not drop descriptive balloon HTML — it is parsed into rows.
 */
export function flattenGisAttributes(
  props: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return null;

  const out: Record<string, unknown> = {};
  const htmlChunks: string[] = [];

  const assign = (key: string, value: unknown) => {
    if (!key || isInternalGisAttributeKey(key)) return;
    const html = htmlPayload(value);
    if (html) {
      htmlChunks.push(html);
      const table = parseHtmlAttributeTable(html);
      for (const [tk, tv] of Object.entries(table)) {
        if (out[tk] == null) out[tk] = clip(tv);
      }
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = fromNestedObject(value as Record<string, unknown>);
      if (nested && typeof nested === 'object' && !Array.isArray(nested) && nested !== value) {
        assign(key, nested);
        return;
      }
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        for (const [nk, nv] of Object.entries(nested as Record<string, unknown>)) {
          assign(nk, nv);
        }
        return;
      }
      assign(key, nested);
      return;
    }
    if (Array.isArray(value)) {
      const parts = value.map((item) => scalarText(item)).filter((v) => v != null);
      if (!parts.length) return;
      if (out[key] == null) out[key] = clip(parts.map(String).join('، '));
      return;
    }
    const scalar = scalarText(value);
    if (scalar == null) return;
    if (typeof scalar === 'string' && looksLikeHtml(scalar)) {
      assign(key, scalar);
      return;
    }
    if (out[key] == null) {
      out[key] = typeof scalar === 'string' ? clip(scalar) : scalar;
    }
  };

  for (const [key, value] of Object.entries(props)) {
    assign(key, value);
  }

  if (out.description == null && htmlChunks.length) {
    const leftover = htmlChunks
      .map((html) => {
        const table = parseHtmlAttributeTable(html);
        if (Object.keys(table).length) return '';
        return stripHtmlToText(html);
      })
      .filter(Boolean)
      .join('\n')
      .trim();
    if (leftover) out.description = clip(leftover);
  }

  return Object.keys(out).length ? out : null;
}

const TITLE_KEYS = new Set(['name', 'نام', 'title', 'code', 'layer', 'layerid', 'layername', 'featuretype', 'id']);

export function gisAttributeRows(
  attrs: Record<string, unknown> | null | undefined,
): GisAttributeRow[] {
  const flat = flattenGisAttributes(attrs);
  if (!flat) return [];
  const rows: GisAttributeRow[] = [];
  for (const [key, raw] of Object.entries(flat)) {
    if (TITLE_KEYS.has(normKey(key))) continue;
    const value = raw == null ? '' : String(raw).trim();
    if (!value) continue;
    rows.push({ key, label: gisAttributeLabel(key), value });
  }
  return rows.slice(0, 80);
}
