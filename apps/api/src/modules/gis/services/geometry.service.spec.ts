import { GeometryService } from './geometry.service';

describe('GeometryService', () => {
  const query = jest.fn();
  const dataSource = { query };
  let service: GeometryService;

  beforeEach(() => {
    query.mockReset();
    service = new GeometryService(dataSource as never);
  });

  it('builds MultiPolygon CASE SQL fragment', () => {
    const sql = service.toMultiPolygonGeoJson('{}');
    expect(sql).toContain('ST_GeomFromGeoJSON');
    expect(sql).toContain('ST_Multi');
    expect(sql).toContain('ST_Polygon');
  });

  it('builds FeatureCollection from raw rows', () => {
    const fc = service.buildFeatureCollection([
      {
        id: 'n1',
        geometry: JSON.stringify({ type: 'Point', coordinates: [51.4, 35.7] }),
        properties: { name: 'محله نمونه' },
      },
    ]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].id).toBe('n1');
    expect(fc.features[0].geometry).toEqual({ type: 'Point', coordinates: [51.4, 35.7] });
    expect(fc.features[0].properties).toEqual({ name: 'محله نمونه' });
  });

  it('reads WKT from geomFromGeoJson', async () => {
    query.mockResolvedValue([{ wkt: 'SRID=4326;MULTIPOLYGON(((0 0,1 0,1 1,0 1,0 0)))' }]);
    const wkt = await service.geomFromGeoJson('{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}');
    expect(wkt).toContain('MULTIPOLYGON');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ST_GeomFromGeoJSON'), [expect.any(String)]);
  });

  it('builds point WKT from lng/lat', async () => {
    query.mockResolvedValue([{ wkt: 'SRID=4326;POINT(51.4 35.7)' }]);
    const wkt = await service.pointFromLngLat(51.4, 35.7);
    expect(wkt).toContain('POINT');
    expect(query.mock.calls[0][1]).toEqual([51.4, 35.7]);
  });

  it('reports geometry validity', async () => {
    query.mockResolvedValue([{ valid: true }]);
    await expect(service.isValidGeometry('{"type":"Point","coordinates":[0,0]}')).resolves.toBe(true);
    query.mockResolvedValue([{ valid: false }]);
    await expect(service.isValidGeometry('{"type":"Point","coordinates":[0,0]}')).resolves.toBe(false);
  });

  it('computes area in square meters', async () => {
    query.mockResolvedValue([{ area: '1234.5' }]);
    await expect(service.computeAreaSqm('{"type":"Polygon","coordinates":[]}'))
      .resolves.toBe(1234.5);
  });
});
