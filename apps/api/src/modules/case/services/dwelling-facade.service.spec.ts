import { DwellingFacadeService } from './dwelling-facade.service';
import { DwellingSource } from '@city-manager/shared';

describe('DwellingFacadeService', () => {
  const repo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ ...x, id: 'd1', source: x.source ?? 'case' })),
    findOne: jest.fn(),
  };
  const dataSource = { query: jest.fn<Promise<unknown[]>, unknown[]>(async () => []) };
  const changeLog = { log: jest.fn(async () => undefined) };

  let service: DwellingFacadeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DwellingFacadeService(repo as never, dataSource as never, changeLog as never);
  });

  it('creates dwelling with case source by default', async () => {
    const res = await service.create('org1', 'u1', { title: 'Test', plaque: '12' });
    expect(res.success).toBe(true);
    expect(repo.save).toHaveBeenCalled();
    expect(changeLog.log).toHaveBeenCalled();
  });

  it('stores land use on create', async () => {
    const res = await service.create('org1', 'u1', { title: 'Test', landUse: 'residential' });
    expect(res.data).toEqual(expect.objectContaining({ landUse: 'residential' }));
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ landUse: 'residential' }));
  });

  it('creates dwelling with gis source', async () => {
    await service.create('org1', undefined, { title: 'Map dwelling' }, DwellingSource.GIS);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ source: DwellingSource.GIS }));
  });

  it('applies geometry on create', async () => {
    dataSource.query.mockResolvedValueOnce([{ id: 'n1' }]).mockResolvedValueOnce([]);
    await service.create('org1', 'u1', {
      title: 'Geo',
      geometry: { type: 'Point', coordinates: [51.4, 35.7] },
    });
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('ST_GeomFromGeoJSON'),
      expect.any(Array),
    );
  });
});
