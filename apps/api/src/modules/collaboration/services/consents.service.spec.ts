import { ConsentsService } from './consents.service';
import { ConsentStatus, ConsentPurpose } from '@city-manager/shared';

describe('ConsentsService', () => {
  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ ...x, id: 'c1' })),
  };
  const mockHouseholds = { findOne: jest.fn() };

  let service: ConsentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConsentsService(mockRepo as never, mockHouseholds as never);
    mockHouseholds.findOne.mockResolvedValue({ id: 'hh1' });
  });

  it('creates pending consent by default', async () => {
    const res = await service.create('org1', 'u1', {
      householdId: 'hh1',
      purpose: ConsentPurpose.AGENCY_REFERRAL,
      scopeFields: ['case_summary'],
    });
    expect(res.success).toBe(true);
    expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ConsentStatus.PENDING }));
  });

  it('grants consent immediately when grantNow=true', async () => {
    await service.create('org1', 'u1', {
      householdId: 'hh1',
      purpose: ConsentPurpose.PORTAL_ACCESS,
      grantNow: true,
      grantedByName: 'Test User',
    });
    expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ConsentStatus.GRANTED }));
  });

  it('requireValid rejects expired consent', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'c1',
      householdId: 'hh1',
      status: ConsentStatus.GRANTED,
      scopeFields: ['case_summary'],
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.requireValid('org1', 'c1', 'hh1', ['case_summary']))
      .rejects.toThrow('منقضی');
  });
});
