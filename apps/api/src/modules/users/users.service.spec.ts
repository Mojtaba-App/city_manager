import { NotFoundException } from '@nestjs/common';
import { UsersService, buildUserSearchWhere } from './users.service';
import { User } from './entities/user.entity';
import { ILike } from 'typeorm';

describe('buildUserSearchWhere', () => {
  it('matches first name, last name, and email', () => {
    const conditions = buildUserSearchWhere('علی', 'org-1');
    expect(conditions).toEqual(
      expect.arrayContaining([
        { organizationId: 'org-1', email: ILike('%علی%') },
        { organizationId: 'org-1', firstName: ILike('%علی%') },
        { organizationId: 'org-1', lastName: ILike('%علی%') },
      ]),
    );
  });

  it('matches full name split across first and last', () => {
    const conditions = buildUserSearchWhere('علی مدیر', 'org-1');
    expect(conditions).toEqual(
      expect.arrayContaining([
        { organizationId: 'org-1', firstName: ILike('%علی%'), lastName: ILike('%مدیر%') },
        { organizationId: 'org-1', firstName: ILike('%مدیر%'), lastName: ILike('%علی%') },
      ]),
    );
  });

  it('matches normalized phone digits', () => {
    const conditions = buildUserSearchWhere('۰۹۱۲', 'org-1');
    expect(conditions).toEqual(
      expect.arrayContaining([
        { organizationId: 'org-1', phone: ILike('%0912%') },
      ]),
    );
  });
});

describe('UsersService', () => {
  const userRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
  };

  const service = new UsersService(userRepo as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findOne returns extended profile fields', async () => {
    const now = new Date('2026-01-15T10:00:00Z');
    userRepo.findOne.mockResolvedValue({
      id: 'u1',
      email: 'admin@city.local',
      firstName: 'علی',
      lastName: 'مدیر',
      phone: '09123456789',
      avatarUrl: 'data:image/png;base64,abc',
      jobTitle: 'مدیر سیستم',
      department: 'ستاد',
      bio: 'مسئول فنی',
      isActive: true,
      organizationId: 'org-1',
      lastLoginAt: now,
      lastLoginIp: '192.168.1.10',
      lastLoginUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      inactiveReason: 'ترک سازمان',
      inactiveAt: now,
      createdAt: now,
      updatedAt: now,
      userRoles: [{ roleId: 'r1', role: { code: 'super_admin' } }],
    } as User);

    const res = await service.findOne('u1', null);
    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({
      id: 'u1',
      email: 'admin@city.local',
      avatarUrl: 'data:image/png;base64,abc',
      jobTitle: 'مدیر سیستم',
      department: 'ستاد',
      bio: 'مسئول فنی',
      roles: ['super_admin'],
      lastLoginIp: '192.168.1.10',
      lastLoginUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      inactiveReason: 'ترک سازمان',
    });
  });

  it('findOne enforces organization scope', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'u2',
      organizationId: 'org-other',
      userRoles: [],
    } as unknown as User);

    await expect(service.findOne('u2', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll applies OR search conditions for names', async () => {
    userRepo.findAndCount.mockResolvedValue([[], 0]);

    await service.findAll({ page: 1, limit: 20, search: 'علی' }, 'org-1');

    expect(userRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildUserSearchWhere('علی', 'org-1'),
      }),
    );
  });
});
