import { NotFoundException } from '@nestjs/common';
import { hasTrajectoryPiiPermission, TrajectoryRecordsService } from './trajectory-records.service';
import { LifeEventType, Permission, TrajectoryRecordType } from '@city-manager/shared';

function repoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => v),
  };
}

describe('hasTrajectoryPiiPermission', () => {
  it('allows explicit PII read', () => {
    expect(hasTrajectoryPiiPermission([Permission.TRAJECTORY_READ_PII])).toBe(true);
  });

  it('allows write permission only when write=true', () => {
    expect(hasTrajectoryPiiPermission([Permission.TRAJECTORY_WRITE])).toBe(false);
    expect(hasTrajectoryPiiPermission([Permission.TRAJECTORY_WRITE], true)).toBe(true);
  });
});

describe('TrajectoryRecordsService', () => {
  const repo = repoMock();
  const versionRepo = repoMock();
  const memberRepo = repoMock();
  const householdRepo = repoMock();
  const changeLog = { log: jest.fn() };
  const svc = new TrajectoryRecordsService(
    repo as never,
    versionRepo as never,
    memberRepo as never,
    householdRepo as never,
    changeLog as never,
  );

  const orgId = 'org-1';
  const householdId = 'hh-1';

  beforeEach(() => {
    jest.clearAllMocks();
    householdRepo.findOne.mockResolvedValue({ id: householdId, organizationId: orgId });
    memberRepo.find.mockResolvedValue([
      { id: 'm1', firstName: 'علی', lastName: 'رضایی', householdId },
    ]);
  });

  it('throws when household is missing', async () => {
    householdRepo.findOne.mockResolvedValue(null);
    await expect(svc.findByHousehold(orgId, householdId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps timeline items with member names and redacted income', async () => {
    repo.find.mockResolvedValue([
      {
        id: 'e1',
        recordType: TrajectoryRecordType.LIFE_EVENT,
        eventType: LifeEventType.JOB_CHANGE,
        eventDate: '2026-01-15',
        memberId: 'm1',
        jobTitle: 'کارگر',
        previousJobTitle: 'بیکار',
        monthlyIncome: 12000000,
        qualityOfLifeScore: 6,
        supportStatus: 'active',
        description: null,
        createdAt: new Date('2026-01-16T10:00:00Z'),
      },
    ]);

    const res = await svc.findByHousehold(orgId, householdId, undefined, false);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].memberName).toBe('علی رضایی');
    expect(res.data[0].summary).toContain('درآمد: [محرمانه]');
    expect(res.data[0].summary).not.toContain('12000000');
  });

  it('builds income trends only when PII is allowed', async () => {
    repo.find.mockResolvedValue([
      {
        eventDate: '2026-02-01',
        monthlyIncome: 10_000_000,
        jobTitle: 'راننده',
        qualityOfLifeScore: 7,
      },
    ]);

    const withoutPii = await svc.getTrends(orgId, householdId, undefined, false);
    expect(withoutPii.data.income).toHaveLength(0);
    expect(withoutPii.data.qualityOfLife).toHaveLength(1);

    const withPii = await svc.getTrends(orgId, householdId, undefined, true);
    expect(withPii.data.income).toEqual([
      { date: '2026-02-01', income: 10_000_000, label: 'راننده' },
    ]);
  });

  it('compares baseline vs current and flags changed fields', async () => {
    repo.findOne
      .mockResolvedValueOnce({
        jobTitle: 'بیکار',
        monthlyIncome: 0,
        qualityOfLifeScore: 4,
        supportStatus: 'none',
        dwellingAddress: 'آدرس قدیم',
        employmentStatus: 'unemployed',
        educationLevel: 'diploma',
        previousIncome: null,
      })
      .mockResolvedValueOnce({
        jobTitle: 'کارگر',
        monthlyIncome: 15_000_000,
        qualityOfLifeScore: 7,
        supportStatus: 'active',
        dwellingAddress: 'آدرس جدید',
        employmentStatus: 'employed',
        educationLevel: 'diploma',
        previousIncome: 0,
      });
    repo.find.mockResolvedValue([]);

    const res = await svc.compare(orgId, householdId, '2025-01-01', '2026-01-01', undefined, false);
    expect(res.success).toBe(true);
    expect(res.data.baselineDate).toBe('2025-01-01');
    expect(res.data.currentDate).toBe('2026-01-01');
    const job = res.data.changes.find((c) => c.field === 'jobTitle');
    expect(job?.changed).toBe(true);
    const income = res.data.changes.find((c) => c.field === 'monthlyIncome');
    expect(income?.after).toBe('[محرمانه]');
  });
});
