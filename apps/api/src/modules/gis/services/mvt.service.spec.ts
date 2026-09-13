import { MvtService } from './mvt.service';

describe('MvtService', () => {
  it('queries ST_AsMVT for neighborhoods', async () => {
    const tile = Buffer.from([0x1a, 0x02]);
    const query = jest.fn().mockResolvedValue([{ mvt: tile }]);
    const svc = new MvtService({ query } as never);
    const out = await svc.getTile('org-1', 'neighborhoods', 10, 3, 4);
    expect(out.equals(tile)).toBe(true);
    expect(query.mock.calls[0][0]).toContain('ST_AsMVT');
    expect(query.mock.calls[0][0]).toContain('ST_TileEnvelope');
    expect(query.mock.calls[0][1]).toEqual([10, 3, 4, 'org-1']);
  });
});
