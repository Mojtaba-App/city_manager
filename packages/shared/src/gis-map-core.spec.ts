import {
  buildLayersGeoJson,
  buildViewportRequestKey,
  featurePopupPlacement,
  geometryKind,
  getGeometryBounds,
  mergeByLayers,
  partitionFeaturesByGeometry,
  resolveMapViewport,
} from './gis-map-core';

describe('gis-map-core', () => {
  it('merges layer chunks without spread stack overflow', () => {
    const prev = {
      type: 'FeatureCollection' as const,
      features: [{ type: 'Feature' as const, properties: { layer: 'neighborhoods' } }],
    };
    const incoming = {
      type: 'FeatureCollection' as const,
      features: Array.from({ length: 80_000 }, (_, i) => ({
        type: 'Feature' as const,
        properties: { layer: 'urban', id: i },
      })),
    };
    const merged = mergeByLayers(prev, incoming, new Set(['urban']));
    expect(merged.features).toHaveLength(80_001);
  });

  it('builds stable viewport keys', () => {
    const v = resolveMapViewport({ west: 48.5, south: 31.2, east: 48.8, north: 31.4 }, 12.04);
    expect(v.bbox.split(',')).toHaveLength(4);
    expect(v.key).toContain('12.0');
    expect(buildViewportRequestKey(v.key, ['a', 'b'], true)).toContain('a,b');
  });

  it('partitions geometry kinds including MultiPoint', () => {
    expect(geometryKind('MultiPoint')).toBe('point');
    expect(geometryKind('MultiPolygon')).toBe('polygon');
    const parts = partitionFeaturesByGeometry([
      { geometry: { type: 'MultiPoint' } },
      { geometry: { type: 'LineString' } },
    ]);
    expect(parts.points).toHaveLength(1);
    expect(parts.lines).toHaveLength(1);
  });

  it('computes bounds for MultiPolygon coordinates', () => {
    const b = getGeometryBounds({
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [2, 0], [2, 1], [0, 1], [0, 0]]], [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]]],
    });
    expect(b[0][0]).toBe(0);
    expect(b[1][0]).toBe(6);
  });

  it('clamps popup placement inside the map container', () => {
    const p = featurePopupPlacement({ x: 10, y: 400 }, { width: 800, height: 600 });
    expect(p.left).toBeGreaterThan(10);
    expect(p.top).toBe(400);
  });

  it('filters urban layers by per-layer visibility', () => {
    const fc = buildLayersGeoJson(
      {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { layer: 'urban', layerId: 'a' } },
          { type: 'Feature', properties: { layer: 'urban', layerId: 'b' } },
        ],
      },
      { neighborhoods: true, fabrics: true, dwellings: true, urban: true },
      { b: false },
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.layerId).toBe('a');
  });
});
