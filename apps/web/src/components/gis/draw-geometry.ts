/** Geometry helpers for GIS draw tools (lng/lat WGS84) */

export type LngLat = [number, number];
export { parseCoordinateText } from '@city-manager/shared';

export function rectanglePolygon(a: LngLat, b: LngLat): GeoJSON.Polygon {
  const minLng = Math.min(a[0], b[0]);
  const maxLng = Math.max(a[0], b[0]);
  const minLat = Math.min(a[1], b[1]);
  const maxLat = Math.max(a[1], b[1]);
  return {
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
      [minLng, minLat],
    ]],
  };
}

/** Axis-aligned square using the larger delta of the two corners */
export function squarePolygon(a: LngLat, b: LngLat): GeoJSON.Polygon {
  const dx = Math.abs(b[0] - a[0]);
  const dy = Math.abs(b[1] - a[1]);
  const size = Math.max(dx, dy);
  const maxLng = a[0] + (b[0] >= a[0] ? size : -size);
  const maxLat = a[1] + (b[1] >= a[1] ? size : -size);
  return rectanglePolygon(a, [maxLng, maxLat]);
}

/** Approximate circle in degrees (good enough for city-scale sketches) */
export function circlePolygon(center: LngLat, edge: LngLat, steps = 64): GeoJSON.Polygon {
  const latRad = (center[1] * Math.PI) / 180;
  const dx = (edge[0] - center[0]) * Math.cos(latRad);
  const dy = edge[1] - center[1];
  const radiusDeg = Math.sqrt(dx * dx + dy * dy);
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const lng = center[0] + (radiusDeg * Math.cos(t)) / Math.cos(latRad);
    const lat = center[1] + radiusDeg * Math.sin(t);
    ring.push([lng, lat]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

export function lineString(points: LngLat[]): GeoJSON.LineString {
  return { type: 'LineString', coordinates: points };
}

export function pointGeometry(p: LngLat): GeoJSON.Point {
  return { type: 'Point', coordinates: p };
}

export function pointsToGeometry(
  points: LngLat[],
  kind: 'point' | 'line' | 'polygon',
): GeoJSON.Geometry | null {
  if (kind === 'point') {
    if (!points[0]) return null;
    return pointGeometry(points[0]);
  }
  if (kind === 'line') {
    if (points.length < 2) return null;
    return lineString(points);
  }
  if (points.length < 3) return null;
  const ring = [...points];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first] as LngLat);
  return { type: 'Polygon', coordinates: [ring] };
}
