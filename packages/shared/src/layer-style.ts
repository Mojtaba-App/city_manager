/** GIS layer appearance and map cursor helpers */

import { toPersianDigits } from './persian-digits';

export function clampOpacity(value: number, fallback = 0.35): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

export function opacityToTransparency(opacity: number): number {
  return clampOpacity(1 - clampOpacity(opacity));
}

export function transparencyToOpacity(transparency: number): number {
  return clampOpacity(1 - clampOpacity(transparency));
}

export function isNoFill(opacity: unknown): boolean {
  const n = Number(opacity);
  return Number.isFinite(n) && n <= 0;
}

export function restoreFillOpacity(previous: unknown, fallback = 0.35): number {
  const n = clampOpacity(Number(previous), fallback);
  return n <= 0 ? fallback : n;
}

/** Layer outline width in pixels (MapLibre line-width). */
export function clampStrokeWidth(value: number, fallback = 2.5): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(8, Math.max(0.5, Math.round(value * 10) / 10));
}

export type UrbanStrokeWidthEntry = { id: string; strokeWidth: number };

/** MapLibre line-width for urban polygon outlines (match by layerId, pixels). */
export function buildUrbanPolygonLineWidthExpression(
  layers: UrbanStrokeWidthEntry[],
  defaultWidth = 2.5,
): unknown[] {
  const fallback = clampStrokeWidth(defaultWidth);
  const matchParts: (string | number)[] = [];
  for (const layer of layers) {
    if (!layer.id) continue;
    matchParts.push(layer.id, clampStrokeWidth(layer.strokeWidth, fallback));
  }

  const urbanWidth: unknown[] = matchParts.length > 0
    ? [
        'to-number',
        [
          'match',
          ['to-string', ['coalesce', ['get', 'layerId'], ['get', 'layer_id'], '']],
          ...matchParts,
          fallback,
        ],
      ]
    : ['to-number', ['coalesce', ['get', 'strokeWidth'], fallback]];

  return [
    'case',
    ['any', ['==', ['get', 'selected'], true], ['==', ['get', 'selected'], 'true']],
    4,
    ['==', ['get', 'layer'], 'urban'],
    urbanWidth,
    ['interpolate', ['linear'], ['zoom'], 11, 1.4, 14, 2.2, 17, 3.2],
  ];
}

export function normalizeHexColor(input: string, fallback = '#2e86ab'): string {
  const v = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return fallback;
}

export function layerColorPatch(hex: string): { colorHex: string; strokeHex: string } {
  const colorHex = normalizeHexColor(hex);
  return { colorHex, strokeHex: colorHex };
}

export type MapHoverCursor = 'crosshair' | 'pointer' | 'grab';

export function mapHoverCursor(opts: {
  drawingToolActive: boolean;
  overFeature: boolean;
}): MapHoverCursor {
  if (opts.drawingToolActive) return 'crosshair';
  if (opts.overFeature) return 'pointer';
  return 'grab';
}

export const GIS_HOVER_LAYER_IDS = ['gis-polygons-fill', 'gis-points-circle', 'gis-lines-line'] as const;

export const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection' as const,
  features: [] as Array<{ type: 'Feature'; geometry: unknown; properties?: Record<string, unknown> | null }>,
};

export function asFeatureCollection(input: unknown): typeof EMPTY_FEATURE_COLLECTION {
  if (!input || typeof input !== 'object') return { type: 'FeatureCollection', features: [] };
  const o = input as Record<string, unknown>;
  if (o.type === 'FeatureCollection' && Array.isArray(o.features)) {
    return { type: 'FeatureCollection', features: o.features as typeof EMPTY_FEATURE_COLLECTION.features };
  }
  if ('data' in o) return asFeatureCollection(o.data);
  return { type: 'FeatureCollection', features: [] };
}

export function applyLayerStyleToFeatures<T extends { properties?: Record<string, unknown> | null }>(
  features: T[],
  match: { layerId?: string; fabricTypeId?: string },
  style: {
    colorHex?: string;
    strokeHex?: string;
    fillOpacity?: number;
    strokeWidth?: number;
    category?: string;
    layerName?: string;
    fabricTypeName?: string;
  },
): T[] {
  return features.map((f) => {
    const props = f.properties ?? {};
    const layerOk = match.layerId
      ? String(props.layerId ?? props.layer_id ?? '') === match.layerId
      : true;
    const fabricOk = match.fabricTypeId
      ? String(props.fabricTypeId ?? props.fabric_type_id ?? '') === match.fabricTypeId
      : true;
    if (!layerOk || !fabricOk || (!match.layerId && !match.fabricTypeId)) return f;
    const strokeHex = style.strokeHex ?? style.colorHex;
    return {
      ...f,
      properties: {
        ...props,
        ...(style.colorHex ? { colorHex: style.colorHex } : {}),
        ...(strokeHex ? { strokeHex } : {}),
        ...(style.fillOpacity != null ? { fillOpacity: style.fillOpacity } : {}),
        ...(style.strokeWidth != null ? { strokeWidth: style.strokeWidth } : {}),
        ...(style.category ? { category: style.category } : {}),
        ...(style.layerName ? { layerName: style.layerName } : {}),
        ...(style.fabricTypeName ? { fabricTypeName: style.fabricTypeName } : {}),
      },
    };
  });
}

export type LayerLabelVisibility = {
  neighborhoods: boolean;
  fabrics: boolean;
  dwellings: boolean;
  urban: Record<string, boolean>;
  fabricTypes: Record<string, boolean>;
};

export function defaultLayerLabelVisibility(): LayerLabelVisibility {
  return {
    neighborhoods: false,
    fabrics: false,
    dwellings: false,
    urban: {},
    fabricTypes: {},
  };
}

function trimLabel(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return '';
  const s = String(value).trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return s;
}

function asAttrRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

const DESCRIPTIVE_NAME_KEYS = [
  'name', 'Name', 'NAME', 'NAM', 'Name_1', 'NAME_1', 'name_1',
  'title', 'Title', 'TITLE',
  'label', 'Label', 'LABEL',
  'نام', 'عنوان', 'محله', 'منطقه',
  'Mahalle', 'mahalle', 'MAHALLE', 'N_Mahalle', 'Mahal_Name',
  'Mantaghe', 'mantaghe', 'REGION', 'Region', 'ZONE_NAME', 'NAME_FA', 'Name_FA',
];

function pickDescriptiveName(bag: Record<string, unknown>): string {
  for (const key of DESCRIPTIVE_NAME_KEYS) {
    const v = trimLabel(bag[key]);
    if (v) return v;
  }
  for (const [key, value] of Object.entries(bag)) {
    if (typeof value === 'object') continue;
    if (/^layer/i.test(key) || /^(id|fid|oid|objectid|code|shape)/i.test(key)) continue;
    if (/^(name|title|label|نام|عنوان|محله|منطقه|mahall|mantegh|region|zone)/i.test(key)) {
      const v = trimLabel(value);
      if (v) return v;
    }
  }
  return '';
}

/**
 * Same title as the GIS feature popup: feature name/title, then GIS attributes,
 * then code (e.g. غرب007). Never the parent layer title.
 */
export function featureMapLabel(props: Record<string, unknown> | null | undefined): string {
  const p = props ?? {};
  const attrs = asAttrRecord(p.attributes ?? p.metadata);
  const raw =
    trimLabel(p.name) ||
    trimLabel(p.title) ||
    pickDescriptiveName(attrs) ||
    pickDescriptiveName(p) ||
    trimLabel(p.code) ||
    trimLabel(p.dwellingCode) ||
    trimLabel(p.dwelling_code);
  return raw ? toPersianDigits(raw) : '';
}

export function isFeatureLabelOn(
  props: Record<string, unknown> | null | undefined,
  labels: LayerLabelVisibility,
): boolean {
  const p = props ?? {};
  const layer = String(p.layer ?? '');
  if (layer === 'neighborhoods') return labels.neighborhoods;
  if (layer === 'dwellings') return labels.dwellings;
  if (layer === 'fabrics') {
    const id = String(p.fabricTypeId ?? p.fabric_type_id ?? '');
    if (id && Object.prototype.hasOwnProperty.call(labels.fabricTypes, id)) {
      return labels.fabricTypes[id];
    }
    return labels.fabrics;
  }
  if (layer === 'urban') {
    const id = String(p.layerId ?? p.layer_id ?? '');
    return Boolean(id && labels.urban[id]);
  }
  return false;
}

export function withMapLabels<T extends { properties?: Record<string, unknown> | null }>(
  features: T[],
  labels: LayerLabelVisibility,
): T[] {
  return features.map((f) => {
    const props = f.properties ?? {};
    const mapLabel = featureMapLabel(props);
    const showLabel = isFeatureLabelOn(props, labels) && mapLabel.length > 0 ? 1 : 0;
    return {
      ...f,
      properties: { ...props, mapLabel, showLabel },
    };
  });
}
