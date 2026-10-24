import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { LoginOtpService } from './login-otp.service';
import { LoginLockoutService } from './login-lockout.service';
import { MessageOutboxStatus, SystemRole } from '@city-manager/shared';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  const userRepo = { findOne: jest.fn(), save: jest.fn() };
  const refreshTokenRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), update: jest.fn() };
  const jwtService = { sign: jest.fn().mockReturnValue('access.jwt') } as unknown as JwtService;
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return 'test';
      if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      return undefined;
    }),
  } as unknown as ConfigService;
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const loginOtp = new LoginOtpService();
  const loginLockout = new LoginLockoutService();
  const messaging = {
    sendEvent: jest.fn().mockResolvedValue({
      status: MessageOutboxStatus.SENT,
    }),
  };

  const svc = new AuthService(
    userRepo as never,
    refreshTokenRepo as never,
    jwtService,
    configService,
    auditService as never,
    loginOtp,
    loginLockout,
    messaging as never,
  );

  const user = {
    id: 'u1',
    email: 'admin@city.local',
    username: 'admin',
    passwordHash: 'hashed',
    isActive: true,
    organizationId: 'org1',
    phone: undefined as string | undefined,
    mustChangePassword: false,
    userRoles: [{ role: { code: SystemRole.ORG_ADMIN } }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (jwtService.sign as jest.Mock).mockReturnValue('access.jwt');
    refreshTokenRepo.save.mockImplementation(async (v: unknown) => v);
    refreshTokenRepo.create.mockImplementation((v: unknown) => v);
    userRepo.save.mockImplementation(async (v: unknown) => v);
    user.phone = undefined;
    user.mustChangePassword = false;
    messaging.sendEvent.mockResolvedValue({ status: MessageOutboxStatus.SENT });
  });

  afterAll(() => {
    loginOtp.onModuleDestroy();
    loginLockout.onModuleDestroy();
  });

  it('rejects unknown or inactive users', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(svc.login({ identifier: 'x@y.z', password: 'p' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid password', async () => {
    userRepo.findOne.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(svc.login({ identifier: 'admin@city.local', password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'login.failed', resource: 'auth', outcome: 'failure' }),
    );
  });

  it('issues tokens and writes audit on successful login without phone', async () => {
    userRepo.findOne.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const result = await svc.login({ identifier: 'admin@city.local', password: 'Admin@1234' }, '127.0.0.1', 'jest');
    expect(result).toMatchObject({ accessToken: 'access.jwt', tokenType: 'Bearer' });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'login', resource: 'auth', userId: 'u1' }),
    );
  });

  it('requires OTP when user has phone, sends SMS, and exposes devCode in test', async () => {
    user.phone = '09123456789';
    userRepo.findOne.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const result = await svc.login({ identifier: 'admin', password: 'Admin@1234' });
    expect(result).toMatchObject({
      requiresOtp: true,
      maskedPhone: expect.stringContaining('***'),
    });
    expect((result as { devCode?: string }).devCode).toMatch(/^\d{6}$/);
    expect((result as { resendAfterSec?: number }).resendAfterSec).toBeGreaterThan(0);
    expect(messaging.sendEvent).toHaveBeenCalledWith(
      'org1',
      'u1',
      expect.objectContaining({
        templateCode: 'otp',
        recipient: '09123456789',
        vars: { code: (result as { devCode: string }).devCode },
      }),
    );
  });

  it('verifies OTP and issues tokens', async () => {
    user.phone = '09123456789';
    userRepo.findOne.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const challenge = await svc.login({ identifier: 'admin@city.local', password: 'Admin@1234' }) as {
      requiresOtp: true;
      challengeId: string;
      devCode: string;
    };
    userRepo.findOne.mockResolvedValue(user);
    const tokens = await svc.verifyLoginOtp({
      challengeId: challenge.challengeId,
      code: challenge.devCode,
    });
    expect(tokens.accessToken).toBe('access.jwt');
  });

  it('returns profile for existing user', async () => {
    userRepo.findOne.mockResolvedValue(user);
    const profile = await svc.getProfile('u1');
    expect(profile.email).toBe('admin@city.local');
    expect(profile.roles).toContain(SystemRole.ORG_ADMIN);
  });

  it('merges catalog permissions so new share_views grants apply for org_admin', async () => {
    userRepo.findOne.mockResolvedValue({
      ...user,
      userRoles: [{
        role: {
          code: SystemRole.ORG_ADMIN,
          permissions: ['reports:read', 'reports:write'],
        },
      }],
    });
    const profile = await svc.getProfile('u1');
    expect(profile.permissions).toContain('share_views:manage');
    expect(profile.permissions).toContain('share_views:read');
    expect(profile.permissions).toContain('reports:write');
  });

  it('forgot-password by phone generates temp password and sends SMS', async () => {
    user.phone = '09123456789';
    userRepo.findOne.mockResolvedValue(user);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    refreshTokenRepo.update.mockResolvedValue({ affected: 1 });

    const res = await svc.forgotPassword({ phone: '09123456789' });
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/پیامک/);
    expect(messaging.sendEvent).toHaveBeenCalledWith(
      'org1',
      'u1',
      expect.objectContaining({
        event: 'password_reset',
        channel: 'sms',
        recipient: '09123456789',
      }),
    );
    expect(userRepo.save).toHaveBeenCalled();
    expect(user.mustChangePassword).toBe(true);
  });

  it('forgot-password rejects unknown phone', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(svc.forgotPassword({ phone: '09121111111' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(messaging.sendEvent).not.toHaveBeenCalled();
  });
});
