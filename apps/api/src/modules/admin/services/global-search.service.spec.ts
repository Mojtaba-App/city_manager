import { GlobalSearchService } from './global-search.service';
import { PiiCryptoService } from '../../case/services/pii-crypto.service';
import { FieldMaskingService } from '../../security/services/field-masking.service';
import { Permission, SystemRole } from '@city-manager/shared';

describe('GlobalSearchService', () => {
  const mockDataSource = { query: jest.fn() };
  const mockPii = { hash: jest.fn((v: string) => `hash-${v}`) };
  const mockMasking = { mask: jest.fn((v: string) => `***${v.slice(-4)}`) };

  let service: GlobalSearchService;

  const baseUser = {
    sub: 'u1',
    orgId: 'org1',
    roles: [SystemRole.SOCIAL_WORKER],
    permissions: [Permission.ORG_READ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GlobalSearchService(
      mockDataSource as never,
      mockPii as unknown as PiiCryptoService,
      mockMasking as unknown as FieldMaskingService,
    );
  });

  it('returns empty for short query', async () => {
    const res = await service.search('org1', 'a', baseUser as never);
    expect(res.data?.items).toEqual([]);
    expect(mockDataSource.query).not.toHaveBeenCalled();
  });

  it('searches households and ranks exact match higher', async () => {
    mockDataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('households')) {
        return [{ id: 'h1', case_number: 'CM-100', status: 'active' }];
      }
      return [];
    });
    const res = await service.search('org1', 'CM-100', baseUser as never, 20);
    expect(res.success).toBe(true);
    expect(res.data?.items[0]?.type).toBe('household');
    expect(res.data?.items[0]?.title).toContain('CM-100');
  });

  it('searches by national id when user has PII permission', async () => {
    const piiUser = { ...baseUser, permissions: [Permission.ORG_READ, Permission.MEMBERS_READ_PII] };
    mockDataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('national_id_hash')) {
        return [{ id: 'm1', household_id: 'h1', first_name: 'Ali', last_name: 'Rezaei', member_role: 'head' }];
      }
      return [];
    });
    const res = await service.search('org1', '1234567890', piiUser as never, 20);
    expect(mockPii.hash).toHaveBeenCalledWith('1234567890');
    expect(res.data?.items.some((i) => i.type === 'member' && i.subtitle?.includes('کد ملی'))).toBe(true);
    expect(res.data?.canSearchNationalId).toBe(true);
  });

  it('fixes project href to layers page', async () => {
    mockDataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('area_projects')) {
        return [{ id: 'p1', name: 'Proj A', status: 'active', target_type: 'neighborhood' }];
      }
      return [];
    });
    const res = await service.search('org1', 'Proj', baseUser as never, 20);
    const project = res.data?.items.find((i) => i.type === 'project');
    expect(project?.href).toBe('/dashboard/layers?project=p1');
  });
});
