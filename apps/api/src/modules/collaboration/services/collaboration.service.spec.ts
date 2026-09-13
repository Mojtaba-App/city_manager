import { NotificationsService } from './notifications.service';
import { ConsentsService } from './consents.service';
import { ReferralsService } from './referrals.service';
import { ConsentStatus, NotificationType, ReferralStatus } from '@city-manager/shared';

describe('Collaboration services', () => {
  describe('NotificationsService', () => {
    it('creates and lists notifications', async () => {
      const saved: unknown[] = [];
      const repo = {
        create: jest.fn((x) => x),
        save: jest.fn(async (x) => { saved.push(x); return { ...x, id: 'n1', createdAt: new Date() }; }),
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getMany: jest.fn(async () => saved),
        })),
        count: jest.fn(async () => saved.length),
        update: jest.fn(async () => ({ affected: 1 })),
        findOne: jest.fn(async () => null),
      };
      const svc = new NotificationsService(repo as never);
      await svc.notify({
        organizationId: 'org',
        userId: 'u1',
        type: NotificationType.SYSTEM,
        title: 'test',
      });
      const list = await svc.listForUser('org', 'u1');
      expect(list.success).toBe(true);
      expect(list.data?.length).toBe(1);
    });
  });

  describe('ConsentsService', () => {
    it('grants pending consent', async () => {
      const consent = {
        id: 'c1',
        organizationId: 'org',
        householdId: 'hh',
        status: ConsentStatus.PENDING,
        scopeFields: ['case_summary'],
      };
      const repo = {
        findOne: jest.fn(async () => consent),
        save: jest.fn(async (x) => x),
        find: jest.fn(async () => [consent]),
        create: jest.fn((x) => x),
      };
      const households = {
        findOne: jest.fn(async () => ({ id: 'hh' })),
      };
      const svc = new ConsentsService(repo as never, households as never);
      const res = await svc.grant('org', 'c1', { grantedByName: 'Ali' });
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe(ConsentStatus.GRANTED);
    });
  });

  describe('ReferralsService', () => {
    it('blocks send without consent', async () => {
      const referral = {
        id: 'r1',
        organizationId: 'org',
        householdId: 'hh',
        consentId: null,
        scopeFields: ['case_summary'],
        status: ReferralStatus.DRAFT,
        title: 't',
      };
      const repo = {
        findOne: jest.fn(async () => referral),
        save: jest.fn(async (x) => x),
        createQueryBuilder: jest.fn(),
        create: jest.fn((x) => x),
      };
      const svc = new ReferralsService(
        repo as never,
        { findOne: jest.fn() } as never,
        { findOne: jest.fn() } as never,
        { query: jest.fn() } as never,
        { requireValid: jest.fn() } as never,
        { notify: jest.fn() } as never,
      );
      await expect(svc.send('org', 'u1', 'r1')).rejects.toThrow('ارسال بدون رضایت ممنوع');
    });
  });
});
