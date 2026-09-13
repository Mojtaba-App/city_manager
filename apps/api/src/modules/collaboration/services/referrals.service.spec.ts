import { BadRequestException } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import {
  ConsentPurpose,
  ReferralDestinationKind,
  ReferralStatus,
} from '@city-manager/shared';

describe('ReferralsService', () => {
  const referralRepo = {
    createQueryBuilder: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ ...x, id: 'r1' })),
    findOne: jest.fn(),
  };
  const agencies = {
    findOne: jest.fn().mockResolvedValue({
      id: 'a1',
      name: 'بهزیستی',
      code: 'behzisti',
      metadata: {},
    }),
  };
  const households = { findOne: jest.fn().mockResolvedValue({ id: 'hh1' }) };
  const dataSource = {
    query: jest.fn().mockResolvedValue([{
      case_number: '100',
      status: 'active',
      member_count: 3,
      vulnerability_score: 4,
      vulnerability_level: 'medium',
      neighborhood_name: 'مرکزی',
      nbhd_district: 2,
      district: '2',
      city: 'شهر',
    }]),
  };
  const consents = {
    requireValid: jest.fn().mockResolvedValue({ id: 'c1' }),
    create: jest.fn().mockResolvedValue({ success: true, data: { id: 'c-new' } }),
  };
  const notifications = { notify: jest.fn() };

  let service: ReferralsService;

  beforeEach(() => {
    jest.clearAllMocks();
    referralRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });
    service = new ReferralsService(
      referralRepo as never,
      agencies as never,
      households as never,
      dataSource as never,
      consents as never,
      notifications as never,
    );
  });

  it('blocks send without consent', async () => {
    referralRepo.findOne.mockResolvedValue({
      id: 'r1',
      organizationId: 'org-1',
      householdId: 'hh1',
      consentId: null,
      scopeFields: ['case_summary'],
      status: ReferralStatus.DRAFT,
      title: 'ارجاع',
    });
    await expect(service.send('org-1', 'u1', 'r1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates referral pending consent when no consentId', async () => {
    const res = await service.create('org-1', 'u1', {
      householdId: 'hh1',
      agencyId: 'a1',
      title: 'ارجاع تست',
    });
    expect(res.success).toBe(true);
    expect(res.data?.status).toBe(ReferralStatus.PENDING_CONSENT);
    expect(res.data?.destinationKind).toBe(ReferralDestinationKind.PARTNER_AGENCY);
    expect(res.data?.destinationLabel).toBe('بهزیستی');
  });

  it('creates municipal district destination dynamically', async () => {
    const res = await service.create('org-1', 'u1', {
      householdId: 'hh1',
      destinationKind: ReferralDestinationKind.MUNICIPAL_DISTRICT,
      municipalDistrict: 4,
      title: 'ارجاع منطقه',
      scopeFields: ['case_summary', 'address_district'],
      createConsent: true,
    });
    expect(consents.create).toHaveBeenCalledWith(
      'org-1',
      'u1',
      expect.objectContaining({
        purpose: ConsentPurpose.AGENCY_REFERRAL,
        grantNow: true,
        scopeFields: ['case_summary', 'address_district'],
      }),
    );
    expect(res.data?.status).toBe(ReferralStatus.READY);
    expect(res.data?.destinationKind).toBe(ReferralDestinationKind.MUNICIPAL_DISTRICT);
    expect(res.data?.municipalDistrict).toBe(4);
    expect(res.data?.destinationCode).toBe('muni-district-4');
    expect(res.data?.destinationLabel).toContain('4');
  });

  it('rejects invalid municipal district', async () => {
    await expect(service.create('org-1', 'u1', {
      householdId: 'hh1',
      destinationKind: ReferralDestinationKind.MUNICIPAL_DISTRICT,
      municipalDistrict: 12,
      title: 'بد',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('attaches consent and marks ready', async () => {
    referralRepo.findOne.mockResolvedValue({
      id: 'r1',
      organizationId: 'org-1',
      householdId: 'hh1',
      status: ReferralStatus.PENDING_CONSENT,
      scopeFields: ['case_summary'],
      title: 'ارجاع',
    });
    const res = await service.attachConsent('org-1', 'r1', { consentId: 'c1' });
    expect(consents.requireValid).toHaveBeenCalled();
    expect(res.data?.status).toBe(ReferralStatus.READY);
    expect(res.data?.consentId).toBe('c1');
  });

  it('sends with minimized payload including destination', async () => {
    referralRepo.findOne.mockResolvedValue({
      id: 'r1',
      organizationId: 'org-1',
      householdId: 'hh1',
      consentId: 'c1',
      scopeFields: ['case_summary', 'member_count', 'address_district'],
      status: ReferralStatus.READY,
      title: 'ارجاع',
      destinationKind: ReferralDestinationKind.MUNICIPAL_DISTRICT,
      municipalDistrict: 2,
      destinationCode: 'muni-district-2',
      destinationLabel: 'منطقه 2 شهرداری',
      purpose: 'agency_referral',
    });
    const res = await service.send('org-1', 'u1', 'r1');
    expect(res.data?.status).toBe(ReferralStatus.SENT);
    expect(res.data?.accessEnabled).toBe(true);
    expect(res.data?.payloadSnapshot).toMatchObject({
      dataMinimization: true,
      memberCount: 3,
      destination: { code: 'muni-district-2' },
    });
    expect((res.data?.payloadSnapshot as { caseSummary?: unknown }).caseSummary).toBeTruthy();
  });
});
