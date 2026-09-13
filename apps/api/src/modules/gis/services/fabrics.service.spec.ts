import { FabricsService } from './fabrics.service';

describe('FabricsService.updateMeta', () => {
  it('updates fabric type after validating the type exists', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'f1', fabric_type_id: 't2', name: 'بافت' }]);
    const fabricTypes = { getOrThrow: jest.fn().mockResolvedValue({ id: 't2' }) };
    const service = new FabricsService(
      {} as never,
      { query } as never,
      {} as never,
      fabricTypes as never,
    );
    const res = await service.updateMeta('org1', 'f1', { fabricTypeId: 't2' });
    expect(fabricTypes.getOrThrow).toHaveBeenCalledWith('org1', 't2');
    expect(query).toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect((res.data as { fabric_type_id: string }).fabric_type_id).toBe('t2');
  });
});
