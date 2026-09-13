/** Pure GIS map helpers — viewport, merge, geometry partition, popup placement. */

type FeatureLike = {
  type?: string;
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
};

type FeatureCollectionLike<T extends FeatureLike = FeatureLike> = {
  type: 'FeatureCollection';
  features: T[];
};

export const GIS_DEFAULT_CENTER: [number, number] = [48.669, 31.3203];
export const GIS_DEFAULT_ZOOM = 12;
export const GIS_VIEWPORT_PAD = 0.18;
export const GIS_VIEWPORT_LAYER_KEYS = new Set(['neighborhoods', 'fabrics', 'urban', 'dwellings']);

export type MapBounds = { west: number; south: number; east: number; north: number };

export function padBounds(bounds: MapBounds, pad = GIS_VIEWPORT_PAD): [number, number, number, number] {
  const w = Math.max(bounds.east - bounds.west, 0.002);
  const h = Math.max(bounds.north - bounds.south, 0.002);
  return [
    bounds.west - w * pad,
    bounds.south - h * pad,
    bounds.east + w * pad,
    bounds.north + h * pad,
  ];
}

export function fallbackMapBbox(): [number, number, number, number] {
  const [lng, lat] = GIS_DEFAULT_CENTER;
  return [lng - 0.18, lat - 0.14, lng + 0.18, lat + 0.14];
}

export function resolveMapViewport(
  bounds: MapBounds | null,
  zoom: number,
): { bbox: string; zoom: number; key: string } {
  const box = bounds ? padBounds(bounds) : fallbackMapBbox();
  const roundedZoom = Math.round(zoom * 10) / 10;
  const key = `${box.map((n) => n.toFixed(3)).join(',')}|${roundedZoom.toFixed(1)}`;
  return { bbox: box.join(','), zoom: roundedZoom, key };
}

export function mergeByLayers<T extends FeatureLike>(
  prev: FeatureCollectionLike<T> | null,
  incoming: FeatureCollectionLike<T> | null | undefined,
  replaceLayers: Set<string>,
): FeatureCollectionLike<T> {
  const kept = (prev?.features ?? []).filter(
    (f) => !replaceLayers.has(String(f.properties?.layer ?? '')),
  );
  const added = incoming?.features ?? [];
  return {
    type: 'FeatureCollection',
    features: kept.length || added.length ? kept.concat(added) : [],
  };
}

export type LayerVisibility = {
  neighborhoods: boolean;
  fabrics: boolean;
  dwellings: boolean;
  urban: boolean;
};

export function buildLayersGeoJson<T extends FeatureLike>(
  fc: FeatureCollectionLike<T> | null | undefined,
  visibility: LayerVisibility,
  urbanLayerVisibility: Record<string, boolean>,
): FeatureCollectionLike<T> {
  const features = (fc?.features ?? []).filter((f) => {
    const layer = String(f.properties?.layer ?? '');
    if (layer === 'neighborhoods' && !visibility.neighborhoods) return false;
    if (layer === 'fabrics' && !visibility.fabrics) return false;
    if (layer === 'dwellings' && !visibility.dwellings) return false;
    if (layer === 'urban') {
      if (!visibility.urban) return false;
      const layerId = String(f.properties?.layerId ?? f.properties?.layer_id ?? '');
      if (layerId && urbanLayerVisibility[layerId] === false) return false;
    }
    return true;
  });
  return { type: 'FeatureCollection', features };
}

export type GeometryKind = 'polygon' | 'point' | 'line' | 'other';

export function geometryKind(type: string | undefined): GeometryKind {
  const t = (type ?? '').toLowerCase();
  if (t.includes('polygon')) return 'polygon';
  if (t === 'point' || t === 'multipoint') return 'point';
  if (t.includes('line')) return 'line';
  return 'other';
}

export function partitionFeaturesByGeometry<T extends { geometry?: { type?: string } | null }>(
  features: T[],
): { polygons: T[]; points: T[]; lines: T[] } {
  const polygons: T[] = [];
  const points: T[] = [];
  const lines: T[] = [];
  for (const f of features) {
    const kind = geometryKind(f.geometry?.type);
    if (kind === 'polygon') polygons.push(f);
    else if (kind === 'point') points.push(f);
    else if (kind === 'line') lines.push(f);
  }
  return { polygons, points, lines };
}

type LngLatPair = [number, number];
type BoundsLike = [[number, number], [number, number]];

function collectCoords(value: unknown, out: LngLatPair[]): void {
  if (!Array.isArray(value) || value.length === 0) return;
  if (typeof value[0] === 'number' && typeof value[1] === 'number') {
    out.push([value[0], value[1]]);
    return;
  }
  for (const item of value) collectCoords(item, out);
}

/** Bounds for fly-to / fitBounds — handles MultiPolygon, MultiLineString, MultiPoint. */
export function getGeometryBounds(geometry: { type: string; coordinates: unknown }): BoundsLike {
  const coords: LngLatPair[] = [];
  collectCoords(geometry.coordinates, coords);
  if (!coords.length) {
    const [lng, lat] = GIS_DEFAULT_CENTER;
    return [[lng - 0.01, lat - 0.01], [lng + 0.01, lat + 0.01]];
  }
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

export type PopupPlacement = {
  left: number;
  top: number;
  transform: string;
};

/** Place feature popup near map click, clamped inside the map container. */
export function featurePopupPlacement(
  point: { x: number; y: number },
  container: { width: number; height: number },
  popupWidth = 380,
): PopupPlacement {
  const margin = 12;
  const half = popupWidth / 2;
  const left = Math.min(Math.max(point.x, half + margin), container.width - half - margin);
  const top = Math.min(Math.max(point.y, margin + 8), container.height - margin);
  return {
    left,
    top,
    transform: 'translate(-50%, calc(-100% - 10px))',
  };
}

export function buildViewportRequestKey(
  viewportKey: string,
  enabledUrbanIds: string[],
  wantDwellings: boolean,
  extras?: {
    neighborhoods?: boolean;
    fabrics?: boolean;
    fabricTypeIds?: string;
  },
): string {
  const urbanPart = enabledUrbanIds.length ? enabledUrbanIds.join(',') : '';
  const n = extras?.neighborhoods ? 1 : 0;
  const f = extras?.fabrics ? 1 : 0;
  const ft = extras?.fabricTypeIds ?? '';
  return `${viewportKey}|u:${urbanPart}|d:${wantDwellings ? 1 : 0}|n:${n}|f:${f}|ft:${ft}`;
}
