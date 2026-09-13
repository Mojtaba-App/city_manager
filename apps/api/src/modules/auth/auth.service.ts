import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  JwtPayload,
  MessageChannel,
  MessageOutboxStatus,
  Permission,
  ROLE_PERMISSIONS,
  SystemRole,
  AuditOutcome,
  AuditSeverity,
  maskPhoneForDisplay,
  validateUserPassword,
} from '@city-manager/shared';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import {
  LoginDto,
  AuthTokensResponseDto,
  UserProfileDto,
  UpdateProfileDto,
  LoginOtpRequiredDto,
  VerifyLoginOtpDto,
  ResendLoginOtpDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { AuditService } from '../audit/audit.service';
import { LoginOtpService, LoginOtpChallenge } from './login-otp.service';
import { LoginLockoutService } from './login-lockout.service';
import { MessagingDispatchService } from '../case/services/messaging-dispatch.service';
import { RedisService } from '../redis/redis.module';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly passwordResetTokens = new Map<string, { userId: string; exp: number }>();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly loginOtp: LoginOtpService,
    private readonly loginLockout: LoginLockoutService,
    private readonly messaging: MessagingDispatchService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async login(
    dto: LoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthTokensResponseDto | LoginOtpRequiredDto> {
    const lockKey = this.loginLockout.keyFor(dto.identifier, ip);
    await this.loginLockout.assertUnlocked(lockKey);

    const user = await this.findUserByIdentifier(dto.identifier);
    if (!user || !user.isActive) {
      return await this.rejectLoginAttempt(lockKey, undefined, dto.identifier, ip, userAgent);
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      return await this.rejectLoginAttempt(lockKey, undefined, dto.identifier, ip, userAgent, user.id, user.organizationId);
    }

    if (user.phone) {
      const exposePlain = this.isDevOtpExposed();
      const challenge = await this.loginOtp.create(
        user.id,
        maskPhoneForDisplay(user.phone),
      );
      await this.dispatchLoginOtpSms(user, challenge.plainCode!, exposePlain);
      return this.toOtpPayload(challenge, exposePlain);
    }

    await this.loginLockout.recordSuccess(lockKey);
    return this.issueSession(user, ip, userAgent);
  }

  async verifyLoginOtp(
    dto: VerifyLoginOtpDto,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthTokensResponseDto> {
    const challenge = await this.loginOtp.get(dto.challengeId);
    if (!challenge) {
      throw new UnauthorizedException('کد تأیید منقضی یا نامعتبر است');
    }
    const pendingUser = await this.userRepo.findOne({ where: { id: challenge.userId } });
    const lockKey = this.loginLockout.keyFor(
      pendingUser?.username || pendingUser?.email || challenge.userId,
      ip,
    );
    await this.loginLockout.assertUnlocked(lockKey);

    const result = await this.loginOtp.verify(dto.challengeId, dto.code);
    if (!result.ok) {
      return await this.rejectLoginAttempt(
        lockKey,
        result.reason,
        pendingUser?.email ?? challenge.userId,
        ip,
        userAgent,
        challenge.userId,
        pendingUser?.organizationId,
      );
    }
    const user = await this.userRepo.findOne({
      where: { id: result.userId },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }
    await this.loginLockout.recordSuccess(lockKey);
    return this.issueSession(user, ip, userAgent);
  }

  async resendLoginOtp(dto: ResendLoginOtpDto): Promise<LoginOtpRequiredDto> {
    const exposePlain = this.isDevOtpExposed();
    const result = await this.loginOtp.resend(dto.challengeId);
    if (!result.ok) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: result.retryAfterSec ? 'OTP_RESEND_WAIT' : 'OTP_INVALID',
        message: result.reason,
        ...(result.retryAfterSec != null ? { retryAfterSec: result.retryAfterSec } : {}),
      });
    }
    const user = await this.userRepo.findOne({ where: { id: result.challenge.userId } });
    if (!user || !user.phone) {
      throw new BadRequestException('کاربر یا شماره همراه یافت نشد');
    }
    await this.dispatchLoginOtpSms(user, result.challenge.plainCode!, exposePlain);
    return this.toOtpPayload(result.challenge, exposePlain);
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponseDto> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
      relations: ['user', 'user.userRoles', 'user.userRoles.role'],
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new ForbiddenException('توکن نامعتبر یا منقضی شده است');
    }

    const user = stored.user;
    if (!user.isActive) {
      throw new ForbiddenException('حساب کاربری غیرفعال است');
    }

    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);

    return this.issueSession(user);
  }

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (!user) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      jobTitle: user.jobTitle,
      department: user.department,
      bio: user.bio,
      organizationId: user.organizationId,
      roles,
      permissions: this.resolvePermissions(
        roles,
        user.userRoles.map((ur) => ur.role),
      ),
    };
  }

  async issueAccessToken(userId: string): Promise<string> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }
    const roleEntities = user.userRoles.map((ur) => ur.role);
    const roles = roleEntities.map((r) => r.code);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      orgId: user.organizationId ?? null,
      roles,
      permissions: this.resolvePermissions(roles, roleEntities),
    };
    return this.jwtService.sign(payload);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfileDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }

    if (dto.firstName != null) user.firstName = dto.firstName.trim();
    if (dto.lastName != null) user.lastName = dto.lastName.trim();
    if (dto.phone !== undefined) user.phone = dto.phone?.trim() || undefined;
    if (dto.jobTitle !== undefined) user.jobTitle = dto.jobTitle?.trim() || undefined;
    if (dto.department !== undefined) user.department = dto.department?.trim() || undefined;
    if (dto.bio !== undefined) user.bio = dto.bio?.trim() || undefined;

    if (dto.avatarUrl !== undefined) {
      if (dto.avatarUrl === null || dto.avatarUrl === '') {
        user.avatarUrl = undefined;
      } else {
        if (!dto.avatarUrl.startsWith('data:image/')) {
          throw new BadRequestException('فرمت تصویر نامعتبر است');
        }
        if (dto.avatarUrl.length > 900_000) {
          throw new BadRequestException('حجم تصویر بیش از حد مجاز است');
        }
        user.avatarUrl = dto.avatarUrl;
      }
    }

    await this.userRepo.save(user);
    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: true }> {
    const pwdErr = validateUserPassword(dto.newPassword, true);
    if (pwdErr) throw new BadRequestException(pwdErr);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('کاربر یافت نشد');
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('رمز فعلی نادرست است');
    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    user.mustChangePassword = false;
    await this.userRepo.save(user);
    await this.auditService.log({
      userId,
      organizationId: user.organizationId,
      action: 'auth.password_change',
      resource: 'auth',
      resourceId: userId,
    });
    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true; message: string }> {
    const user = await this.findUserByIdentifier(dto.identifier);
    // Always same response to avoid user enumeration
    const message = 'اگر حسابی با این مشخصات وجود داشته باشد، لینک بازیابی ارسال می‌شود.';
    if (!user || !user.isActive || !user.email) return { success: true, message };

    const token = crypto.randomBytes(32).toString('hex');
    const ttlSec = 30 * 60;
    const payload = { userId: user.id, exp: Date.now() + ttlSec * 1000 };
    if (this.redis?.enabled) {
      await this.redis.setJson(`cm:pwdreset:${token}`, payload, ttlSec);
    } else {
      this.passwordResetTokens.set(token, payload);
    }

    const appOrigin = this.configService.get<string>('CORS_ORIGIN', 'http://localhost:3000').split(',')[0].trim();
    const resetUrl = `${appOrigin}/login?reset=${token}`;
    if (user.organizationId) {
      await this.messaging.sendEvent(user.organizationId, user.id, {
        event: 'password_reset',
        channel: MessageChannel.EMAIL,
        recipient: user.email,
        templateCode: 'notify',
        subject: 'بازیابی رمز عبور',
        vars: { message: `برای تنظیم رمز جدید به این نشانی بروید: ${resetUrl}` },
      });
    }
    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'auth.password_reset_request',
      resource: 'auth',
      resourceId: user.id,
    });
    return { success: true, message };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const pwdErr = validateUserPassword(dto.newPassword, true);
    if (pwdErr) throw new BadRequestException(pwdErr);

    let payload: { userId: string; exp: number } | null = null;
    if (this.redis?.enabled) {
      payload = await this.redis.getJson(`cm:pwdreset:${dto.token}`);
      if (payload) await this.redis.del(`cm:pwdreset:${dto.token}`);
    } else {
      payload = this.passwordResetTokens.get(dto.token) ?? null;
      this.passwordResetTokens.delete(dto.token);
    }
    if (!payload || payload.exp < Date.now()) {
      throw new BadRequestException('لینک بازیابی نامعتبر یا منقضی است');
    }
    const user = await this.userRepo.findOne({ where: { id: payload.userId } });
    if (!user || !user.isActive) throw new BadRequestException('کاربر یافت نشد');
    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepo.save(user);
    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'auth.password_reset',
      resource: 'auth',
      resourceId: user.id,
    });
    return { success: true };
  }

  async logout(refreshToken: string, userId: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokenRepo.update(
      { tokenHash, userId },
      { revokedAt: new Date() },
    );
  }

  private async rejectLoginAttempt(
    lockKey: string,
    message = 'نام کاربری/ایمیل یا رمز عبور اشتباه است',
    identifier?: string,
    ip?: string,
    userAgent?: string,
    userId?: string,
    organizationId?: string | null,
  ): Promise<never> {
    try {
      await this.auditService.log({
        userId,
        organizationId: organizationId ?? undefined,
        action: 'login.failed',
        resource: 'auth',
        payload: { identifier: identifier?.slice(0, 120) },
        ipAddress: ip,
        userAgent,
        outcome: AuditOutcome.FAILURE,
        severity: AuditSeverity.WARNING,
      });
    } catch {
      /* never block login on audit failure */
    }
    await this.loginLockout.recordFailure(lockKey);
    throw new UnauthorizedException(message);
  }

  private toOtpPayload(challenge: LoginOtpChallenge, exposePlain: boolean): LoginOtpRequiredDto {
    const payload: LoginOtpRequiredDto = {
      requiresOtp: true,
      challengeId: challenge.id,
      maskedPhone: challenge.maskedPhone,
      expiresInSec: Math.max(1, Math.floor((challenge.expiresAt - Date.now()) / 1000)),
      resendAfterSec: this.loginOtp.resendAfterSec(challenge),
    };
    if (exposePlain && challenge.plainCode) {
      payload.devCode = challenge.plainCode;
    }
    return payload;
  }

  private async findUserByIdentifier(identifier: string): Promise<User | null> {
    const raw = identifier.trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (raw.includes('@')) {
      return this.userRepo.findOne({
        where: { email: lower },
        relations: ['userRoles', 'userRoles.role'],
      });
    }
    return this.userRepo.findOne({
      where: { username: lower },
      relations: ['userRoles', 'userRoles.role'],
    });
  }

  private async issueSession(
    user: User,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthTokensResponseDto> {
    const roleEntities = user.userRoles.map((ur) => ur.role);
    const roles = roleEntities.map((r) => r.code);
    const permissions = this.resolvePermissions(roles, roleEntities);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      orgId: user.organizationId ?? null,
      roles,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    user.lastLoginAt = new Date();
    if (ip) user.lastLoginIp = ip.slice(0, 45);
    if (userAgent) user.lastLoginUserAgent = userAgent.slice(0, 2000);
    await this.userRepo.save(user);

    await this.auditService.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'login',
      resource: 'auth',
      ipAddress: ip,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      tokenType: 'Bearer',
    };
  }

  private async dispatchLoginOtpSms(
    user: User,
    plainCode: string,
    allowLocalFallback: boolean,
  ): Promise<void> {
    if (!user.organizationId || !user.phone) {
      throw new BadRequestException('شماره همراه برای ارسال کد تنظیم نشده است');
    }

    const outbox = await this.messaging.sendEvent(user.organizationId, user.id, {
      event: 'login_otp',
      channel: MessageChannel.SMS,
      recipient: user.phone,
      templateCode: 'otp',
      vars: { code: plainCode },
    });

    if (!outbox) {
      if (allowLocalFallback) {
        this.logger.warn('SMS messaging disabled; OTP available only via local/dev exposure');
        return;
      }
      throw new ServiceUnavailableException(
        'ارسال پیامک کد تأیید غیرفعال است. با مدیر سیستم تماس بگیرید.',
      );
    }

    if (
      outbox.status === MessageOutboxStatus.FAILED
      || outbox.status === MessageOutboxStatus.SKIPPED
    ) {
      if (allowLocalFallback) {
        this.logger.warn(`SMS OTP dispatch ${outbox.status}: ${outbox.errorMessage ?? ''}`);
        return;
      }
      throw new ServiceUnavailableException(
        outbox.errorMessage || 'ارسال کد تأیید ناموفق بود. چند لحظه بعد دوباره تلاش کنید.',
      );
    }
  }

  private isDevOtpExposed(): boolean {
    const env = this.configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
    if (env === 'production') return false;
    const flag = this.configService.get<string>('SHOW_LOGIN_OTP_IN_DEV');
    if (flag === '0' || flag === 'false') return false;
    if (flag === '1' || flag === 'true') return true;
    // Local/dev/test only — never staging/production-like hosts by default
    return env === 'development' || env === 'test';
  }

  private resolvePermissions(
    roles: string[],
    roleEntities?: Array<{ code: string; permissions: string[] }>,
  ): Permission[] {
    const set = new Set<Permission>();
    const codes = (roleEntities?.length ? roleEntities.map((r) => r.code) : roles)
      .filter(Boolean) as string[];

    for (const code of codes) {
      for (const p of ROLE_PERMISSIONS[code as SystemRole] ?? []) set.add(p);
    }

    if (roleEntities?.length) {
      for (const role of roleEntities) {
        for (const p of role.permissions ?? []) set.add(p as Permission);
      }
    }

    return Array.from(set);
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = this.parseExpiry(expiresIn);

    await this.refreshTokenRepo.save({
      userId,
      tokenHash,
      expiresAt,
    });

    return rawToken;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(expiry: string): Date {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return new Date(Date.now() + value * multipliers[unit]);
  }
}
