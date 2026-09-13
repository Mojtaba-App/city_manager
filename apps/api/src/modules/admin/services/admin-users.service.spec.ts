jest.mock('bcrypt', () => ({
  hash: jest.fn(async (p: string) => `hashed:${p}`),
}));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AdminUsersService } from './admin-users.service';

const roleId = '11111111-1111-4111-8111-111111111111';

function savedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@city.local',
    firstName: 'علی',
    lastName: 'رضایی',
    phone: '09123456789',
    isActive: true,
    organizationId: 'org-1',
    userRoles: [{ roleId, role: { code: 'viewer' } }],
    lastLoginAt: null,
    createdAt: new Date(),
    inactiveReason: undefined as string | undefined,
    inactiveAt: undefined as Date | undefined,
    inactiveBy: undefined as string | undefined,
    ...overrides,
  };
}

describe('AdminUsersService', () => {
  const userRepo = {
    findOne: jest.fn(),
    create: jest.fn((v: unknown) => v),
    save: jest.fn(),
    restore: jest.fn(),
    softDelete: jest.fn(),
  };
  const roleRepo = { findBy: jest.fn() };
  const userRoleRepo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => v),
    delete: jest.fn(),
  };
  const audit = { log: jest.fn() };

  let service: AdminUsersService;

  const createDto = {
    email: 'User@city.local',
    password: 'Secret123',
    firstName: 'علی',
    lastName: 'رضایی',
    phone: '09123456789',
    roleIds: [roleId],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo.create.mockImplementation((v: unknown) => v);
    userRepo.save.mockImplementation(async (v: Record<string, unknown>) => ({ id: 'user-1', ...v }));
    service = new AdminUsersService(
      userRepo as never,
      roleRepo as never,
      userRoleRepo as never,
      audit as never,
    );
  });

  it('creates user, hashes password and assigns roles', async () => {
    userRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(savedUser());
    roleRepo.findBy.mockResolvedValue([{ id: roleId }]);

    const res = await service.create('org-1', 'actor-1', createDto as never);
    expect(res.success).toBe(true);
    expect(userRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'user@city.local' },
      withDeleted: true,
    }));
    expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      email: 'user@city.local',
      passwordHash: 'hashed:Secret123',
      phone: '09123456789',
      isActive: true,
    }));
    expect(userRoleRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'user-1', roleId }),
    ]);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.create' }));
  });

  it('rejects weak password and invalid mobile before save', async () => {
    await expect(service.create('org-1', 'actor-1', {
      ...createDto,
      password: 'password',
    } as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('org-1', 'actor-1', {
      ...createDto,
      phone: '02112345678',
    } as never)).rejects.toThrow(/موبایل/);
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('normalizes +98 mobile on create', async () => {
    userRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(savedUser());
    await service.create('org-1', 'actor-1', {
      ...createDto,
      phone: '+98 912 345 6789',
      roleIds: [],
    } as never);
    expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ phone: '09123456789' }));
  });

  it('restores a soft-deleted user with the same email', async () => {
    const deleted = savedUser({ deletedAt: new Date('2026-01-01'), isActive: false });
    userRepo.findOne
      .mockResolvedValueOnce(deleted)
      .mockResolvedValueOnce(savedUser({ isActive: true }));
    roleRepo.findBy.mockResolvedValue([{ id: roleId }]);

    const res = await service.create('org-1', 'actor-1', createDto as never);
    expect(userRepo.restore).toHaveBeenCalledWith('user-1');
    expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      deletedAt: undefined,
      isActive: true,
      passwordHash: 'hashed:Secret123',
    }));
    expect(userRoleRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.restore' }));
    expect(res.success).toBe(true);
  });

  it('rejects duplicate email', async () => {
    userRepo.findOne.mockResolvedValue(savedUser());
    await expect(service.create('org-1', 'actor-1', createDto as never))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('maps unique-email database error to conflict', async () => {
    userRepo.findOne.mockResolvedValueOnce(null);
    userRepo.save.mockRejectedValueOnce(new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'users_email_key',
    })));
    await expect(service.create('org-1', 'actor-1', { ...createDto, roleIds: [] } as never))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('replaces roles on update', async () => {
    const user = savedUser();
    userRepo.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(savedUser({
        userRoles: [{ roleId: 'r2', role: { code: 'manager' } }],
      }));
    roleRepo.findBy.mockResolvedValue([{ id: 'r2' }]);

    const res = await service.update('user-1', 'org-1', 'actor-1', { roleIds: ['r2'] });
    expect(userRoleRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(res.data).toEqual(expect.objectContaining({ roles: ['manager'], roleIds: ['r2'] }));
  });

  it('rejects self-deactivation and allows toggling another user', async () => {
    userRepo.findOne.mockResolvedValue(savedUser({ id: 'actor-1' }));
    await expect(service.update('actor-1', 'org-1', 'actor-1', { isActive: false, inactiveReason: 'تست' }))
      .rejects.toThrow(/حساب خود/);
    expect(userRepo.save).not.toHaveBeenCalled();

    await expect(service.update('user-2', 'org-1', 'actor-1', { isActive: false }))
      .rejects.toThrow(/دلیل/);

    const other = savedUser({ id: 'user-2' });
    userRepo.findOne
      .mockResolvedValueOnce(other)
      .mockResolvedValueOnce({ ...other, isActive: false, userRoles: [] });
    const res = await service.update('user-2', 'org-1', 'actor-1', {
      isActive: false,
      inactiveReason: 'ترک سازمان',
    });
    expect(other.isActive).toBe(false);
    expect(other.inactiveReason).toBe('ترک سازمان');
    expect(res.success).toBe(true);
  });

  it('soft-deletes user with reason and blocks self-delete', async () => {
    userRepo.findOne.mockResolvedValue(savedUser({ id: 'actor-1' }));
    await expect(service.remove('actor-1', 'org-1', 'actor-1', 'دلیل حذف'))
      .rejects.toThrow(/حساب خود/);

    const other = savedUser({ id: 'user-2' });
    userRepo.findOne.mockResolvedValue(other);
    const res = await service.remove('user-2', 'org-1', 'actor-1', 'حساب تکراری');
    expect(other.isActive).toBe(false);
    expect(other.inactiveReason).toBe('حساب تکراری');
    expect(userRepo.softDelete).toHaveBeenCalledWith('user-2');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.delete' }));
    expect(res.data).toEqual({ removed: true });
  });

  it('rejects unknown role ids', async () => {
    userRepo.findOne.mockResolvedValue(savedUser());
    roleRepo.findBy.mockResolvedValue([]);
    await expect(service.update('user-1', 'org-1', 'actor-1', { roleIds: [roleId] }))
      .rejects.toThrow(/نقش نامعتبر/);
  });
});
