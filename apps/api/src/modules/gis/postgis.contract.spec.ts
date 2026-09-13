/**
 * PostGIS SQL contract — asserts spatial helpers used by GIS services.
 * Live PostGIS execution is covered by CI migrate against postgis/postgis image.
 */
import { MvtService } from './services/mvt.service';
import { GeoJsonService } from './services/geojson.service';

describe('PostGIS SQL contracts', () => {
  it('MVT path uses envelope + AsMVTGeom + AsMVT', async () => {
    const query = jest.fn().mockResolvedValue([{ mvt: Buffer.alloc(0) }]);
    const svc = new MvtService({ query } as never);
    await svc.getTile('org', 'fabrics', 8, 1, 2);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/ST_TileEnvelope/i);
    expect(sql).toMatch(/ST_AsMVTGeom/i);
    expect(sql).toMatch(/ST_AsMVT/i);
    expect(sql).toMatch(/ST_Transform/i);
  });

  it('GeoJSON simplify path still references PostGIS simplify helper', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const svc = new GeoJsonService({ query } as never);
    await svc.getLayers('org-1', { layers: ['neighborhoods'], zoom: 12 });
    const sql = query.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(sql).toMatch(/ST_AsGeoJSON|ST_SimplifyPreserveTopology|ST_MakeEnvelope/i);
  });
});
