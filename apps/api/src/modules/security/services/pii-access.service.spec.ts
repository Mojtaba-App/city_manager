import { PiiAccessService } from './pii-access.service';
import { PiiAccessPurpose } from '@city-manager/shared';

describe('PiiAccessService', () => {
  const accessRepo = {
    save: jest.fn(async (x) => x),
    create: jest.fn((x) => x),
    query: jest.fn(async () => []),
  };
  const exportRepo = {
    save: jest.fn(async (x) => x),
    create: jest.fn((x) => x),
    find: jest.fn(async () => []),
  };
  const grantRepo = {
    save: jest.fn(async (x) => ({ ...x, id: 'g1' })),
    create: jest.fn((x) => x),
    find: jest.fn(async () => []),
  };
  const pii = { hash: jest.fn((v: string) => `hash:${v}`) };

  let service: PiiAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PiiAccessService(
      accessRepo as never,
      exportRepo as never,
      grantRepo as never,
      pii as never,
    );
  });

  it('requires reason for grant', async () => {
    await expect(
      service.createGrant('org1', 'u1', 'admin', {
        resourceType: 'household',
        purpose: PiiAccessPurpose.CASE_REVIEW,
        reason: '  ',
      }),
    ).rejects.toThrow('ذکر دلیل دسترسی الزامی است');
  });

  it('creates grant with expiry', async () => {
    const res = await service.createGrant('org1', 'u1', 'admin', {
      resourceType: 'household',
      resourceId: 'h1',
      purpose: PiiAccessPurpose.CASE_REVIEW,
      reason: 'بررسی پرونده',
      expiresInHours: 2,
    });
    expect(res.success).toBe(true);
    expect(grantRepo.save).toHaveBeenCalled();
    expect(res.data?.reason).toBe('بررسی پرونده');
  });

  it('logs export', async () => {
    await service.logExport('org1', 'u1', 'report_csv', 42, 'گزارش مدیریتی');
    expect(exportRepo.save).toHaveBeenCalled();
  });

  it('hashes national id', () => {
    expect(service.hashNationalId('123')).toBe('hash:123');
  });
});
