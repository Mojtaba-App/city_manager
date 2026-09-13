import { FormsService } from './support-services';
import { CaseEntityType } from '@city-manager/shared';

describe('FormsService.upsert', () => {
  const repo = {
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(async (x) => x),
    create: jest.fn((x) => x),
  };

  function service() {
    return new FormsService(repo as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    repo.findOne.mockResolvedValue(null);
  });

  it('rejects invalid schema (empty select)', async () => {
    const res = await service().upsert('org-1', {
      entityType: CaseEntityType.HOUSEHOLD,
      name: 'فرم خانوار',
      schema: {
        sections: [],
        fields: [{ key: 'kind', label: 'نوع', type: 'select' }],
      },
    });
    expect(res.success).toBe(false);
    expect(res.error?.message).toContain('گزینه');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('saves a valid schema as next version', async () => {
    repo.findOne.mockResolvedValue({ version: 2 });
    const res = await service().upsert('org-1', {
      entityType: CaseEntityType.HOUSEHOLD,
      name: 'فرم خانوار',
      schema: {
        sections: [{ id: 'custom', title: 'تکمیلی' }],
        fields: [{ key: 'score', label: 'امتیاز', type: 'number', section: 'custom' }],
      },
    });
    expect(res.success).toBe(true);
    expect(repo.update).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ version: 3, isActive: true }));
  });
});
