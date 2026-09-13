import { GeoJsonService, simplifyToleranceForZoom } from './geojson.service';

describe('GeoJsonService', () => {
  const dataSource = { query: jest.fn() };
  const svc = new GeoJsonService(dataSource as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps simplify gentle at city zoom and disables it when zoomed in', () => {
    expect(simplifyToleranceForZoom(12)).toBe(0.00015);
    expect(simplifyToleranceForZoom(16)).toBe(0);
  });

  it('simplifies neighborhood/fabric geometry with zoom tolerance', async () => {
    dataSource.query.mockResolvedValue([]);
    await (svc as unknown as {
      fetchNeighborhoods: (orgId: string, options: { bbox?: [number, number, number, number]; zoom?: number }) => Promise<unknown>;
    }).fetchNeighborhoods('org-1', { bbox: [48.6, 31.3, 48.8, 31.5], zoom: 12 });
    const sql = String(dataSource.query.mock.calls[0][0]);
    expect(sql).toContain('ST_SimplifyPreserveTopology');
    expect(sql).toContain('ST_MakeEnvelope');
  });

  it('loads full urban layers without rank caps or viewport limits', async () => {
    dataSource.query.mockResolvedValue([]);

    await (svc as unknown as {
      fetchUrbanLayers: (
        orgId: string,
        options: { urbanLayerIds?: string[]; bbox?: [number, number, number, number]; zoom?: number },
      ) => Promise<unknown>;
    }).fetchUrbanLayers('org-1', {
      urbanLayerIds: ['l1', 'l2'],
      bbox: [48.6, 31.3, 48.8, 31.5],
      zoom: 12,
    });

    const sql = String(dataSource.query.mock.calls[0][0]);
    expect(sql).not.toContain('ROW_NUMBER');
    expect(sql).not.toContain('LIMIT');
    expect(sql).not.toContain('hashtext');
    expect(sql).toContain('best_published');
    expect(sql).toContain('layer_stroke_width');
  });

  it('maps layer-level style onto GeoJSON properties', async () => {
    dataSource.query.mockResolvedValue([
      {
        id: 'f1',
        code: 'A1',
        name: 'Feature A',
        area_sqm: 100,
        layer_id: 'layer-1',
        attributes: { zone: 'A' },
        layer_code: 'roads',
        layer_name: 'Roads',
        category: 'custom',
        layer_color_hex: '#123456',
        layer_fill_opacity: '0.25',
        stroke_hex: '#111111',
        layer_stroke_width: '3.5',
        geometry: { type: 'Polygon', coordinates: [] },
      },
    ]);

    const res = await (svc as unknown as {
      fetchUrbanLayers: (
        orgId: string,
        options: { urbanLayerIds?: string[]; bbox?: [number, number, number, number]; zoom?: number },
      ) => Promise<Array<{ properties: Record<string, unknown> }>>;
    }).fetchUrbanLayers('org-1', {
      urbanLayerIds: ['layer-1'],
      bbox: [48.6, 31.3, 48.8, 31.5],
      zoom: 16,
    });

    expect(res).toHaveLength(1);
    expect(res[0].properties.colorHex).toBe('#123456');
    expect(res[0].properties.fillOpacity).toBe(0.25);
    expect(res[0].properties.strokeHex).toBe('#111111');
    expect(res[0].properties.strokeWidth).toBe(3.5);
    expect(res[0].properties.attributes).toEqual({ zone: 'A' });
  });

  it('merges large urban responses without stack overflow', async () => {
    const big = Array.from({ length: 80_000 }, (_, i) => ({
      id: `f-${i}`,
      code: null,
      name: null,
      area_sqm: null,
      layer_id: 'layer-1',
      attributes: null,
      layer_code: 'roads',
      layer_name: 'Roads',
      category: 'custom',
      layer_color_hex: '#123456',
      layer_fill_opacity: '0.25',
      stroke_hex: '#111111',
      layer_stroke_width: '2.5',
      geometry: { type: 'Polygon', coordinates: [] },
    }));
    dataSource.query.mockResolvedValue(big);

    const result = await svc.getLayers('org-1', {
      layers: ['urban'],
      urbanLayerIds: ['layer-1'],
    });

    // Hard-capped for memory/response size; clients page with limit/offset.
    expect(result.features).toHaveLength(50_000);
  });
});
