import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { UserRole } from '../../users/entities/user-role.entity';
import { CreateUserDto, UpdateUserDto } from '../dto/admin.dto';
import { ApiResponse, toIranMobile, validateAdminUserInput, validateInactiveReason } from '@city-manager/shared';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserRole) private readonly userRoleRepo: Repository<UserRole>,
    private readonly audit: AuditService,
  ) {}

  async create(orgId: string | null, actorId: string, dto: CreateUserDto): Promise<ApiResponse<unknown>> {
    this.assertFields(dto, 'create');
    const email = dto.email.toLowerCase();
    const username = this.usernameOrUndef(dto.username);
    const existing = await this.userRepo.findOne({ where: { email }, withDeleted: true });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('ایمیل تکراری است');
    }
    if (username) {
      const taken = await this.userRepo.findOne({ where: { username } });
      if (taken) throw new ConflictException('نام کاربری تکراری است');
    }

    const targetOrg = dto.organizationId ?? orgId ?? existing?.organizationId;
    if (!targetOrg) throw new BadRequestException('سازمان الزامی است');

    if (existing?.deletedAt) {
      return this.reviveDeleted(existing, targetOrg, actorId, dto);
    }

    try {
      const user = await this.userRepo.save(
        this.userRepo.create({
          email,
          username,
          passwordHash: await bcrypt.hash(dto.password, 12),
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: this.phoneOrUndef(dto.phone),
          organizationId: targetOrg,
          isActive: true,
          isEmailVerified: false,
        }),
      );

      if (dto.roleIds?.length) {
        await this.assignRoles(user.id, dto.roleIds);
      }

      await this.audit.log({
        userId: actorId,
        organizationId: targetOrg,
        action: 'user.create',
        resource: 'users',
        resourceId: user.id,
        payload: { email: user.email },
      });

      return this.findSafe(user.id);
    } catch (err) {
      return this.throwIfDuplicateEmail(err);
    }
  }

  async update(
    id: string,
    orgScope: string | null,
    actorId: string,
    dto: UpdateUserDto,
  ): Promise<ApiResponse<unknown>> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user || (orgScope && user.organizationId !== orgScope)) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    this.assertFields(dto, 'update');
    if (dto.isActive === false && id === actorId) {
      throw new BadRequestException('نمی‌توانید حساب خود را غیرفعال کنید');
    }

    if (dto.firstName != null) user.firstName = dto.firstName;
    if (dto.lastName != null) user.lastName = dto.lastName;
    if (dto.username !== undefined) {
      const nextUsername = this.usernameOrUndef(dto.username);
      if (nextUsername && nextUsername !== user.username) {
        const taken = await this.userRepo.findOne({ where: { username: nextUsername } });
        if (taken && taken.id !== id) throw new ConflictException('نام کاربری تکراری است');
      }
      user.username = nextUsername;
    }
    if (dto.phone !== undefined) user.phone = this.phoneOrUndef(dto.phone);
    if (dto.isActive != null) {
      if (dto.isActive === false) {
        const reasonErr = validateInactiveReason(dto.inactiveReason);
        if (reasonErr) throw new BadRequestException(reasonErr);
        user.isActive = false;
        user.inactiveReason = String(dto.inactiveReason).trim();
        user.inactiveAt = new Date();
        user.inactiveBy = actorId;
      } else {
        user.isActive = true;
        user.inactiveReason = undefined;
        user.inactiveAt = undefined;
        user.inactiveBy = undefined;
      }
    }
    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 12);
      user.mustChangePassword = dto.mustChangePassword ?? true;
    } else if (dto.mustChangePassword != null) {
      user.mustChangePassword = dto.mustChangePassword;
    }

    try {
      await this.userRepo.save(user);
    } catch (err) {
      return this.throwIfDuplicateEmail(err);
    }

    if (dto.roleIds) {
      await this.userRoleRepo.delete({ userId: id });
      if (dto.roleIds.length) await this.assignRoles(id, dto.roleIds);
    }

    await this.audit.log({
      userId: actorId,
      organizationId: user.organizationId,
      action: dto.isActive === false ? 'user.deactivate' : 'user.update',
      resource: 'users',
      resourceId: id,
      payload: {
        fields: Object.keys(dto),
        ...(dto.isActive === false && dto.inactiveReason
          ? { inactiveReason: dto.inactiveReason }
          : {}),
      },
    });

    return this.findSafe(id);
  }

  async remove(
    id: string,
    orgScope: string | null,
    actorId: string,
    inactiveReason: string,
  ): Promise<ApiResponse<{ removed: true }>> {
    const reasonErr = validateInactiveReason(inactiveReason);
    if (reasonErr) throw new BadRequestException(reasonErr);

    const user = await this.userRepo.findOne({ where: { id } });
    if (!user || (orgScope && user.organizationId !== orgScope)) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    if (id === actorId) {
      throw new BadRequestException('نمی‌توانید حساب خود را حذف کنید');
    }

    user.isActive = false;
    user.inactiveReason = inactiveReason.trim();
    user.inactiveAt = new Date();
    user.inactiveBy = actorId;
    await this.userRepo.save(user);
    await this.userRepo.softDelete(id);

    await this.audit.log({
      userId: actorId,
      organizationId: user.organizationId,
      action: 'user.delete',
      resource: 'users',
      resourceId: id,
      payload: { inactiveReason: inactiveReason.trim(), email: user.email },
    });

    return { success: true, data: { removed: true } };
  }

  private phoneOrUndef(phone?: string) {
    if (!phone) return undefined;
    return toIranMobile(phone);
  }

  private usernameOrUndef(username?: string) {
    if (!username) return undefined;
    return username.trim().toLowerCase();
  }

  private throwIfDuplicateEmail(err: unknown): never {
    if (err instanceof QueryFailedError) {
      const driver = err.driverError as { code?: string; constraint?: string } | undefined;
      const text = `${driver?.constraint ?? ''} ${err.message}`;
      if (driver?.code === '23505') {
        if (/username/i.test(text)) throw new ConflictException('نام کاربری تکراری است');
        if (/email/i.test(text)) throw new ConflictException('ایمیل تکراری است');
      }
    }
    throw err;
  }

  private async reviveDeleted(
    user: User,
    orgId: string,
    actorId: string,
    dto: CreateUserDto,
  ): Promise<ApiResponse<unknown>> {
    await this.userRepo.restore(user.id);
    user.deletedAt = undefined;
    user.passwordHash = await bcrypt.hash(dto.password, 12);
    user.firstName = dto.firstName;
    user.lastName = dto.lastName;
    user.username = this.usernameOrUndef(dto.username);
    user.phone = this.phoneOrUndef(dto.phone);
    user.organizationId = orgId;
    user.isActive = true;
    user.isEmailVerified = false;

    try {
      await this.userRepo.save(user);
    } catch (err) {
      return this.throwIfDuplicateEmail(err);
    }

    if (dto.roleIds) {
      await this.userRoleRepo.delete({ userId: user.id });
      if (dto.roleIds.length) await this.assignRoles(user.id, dto.roleIds);
    }

    await this.audit.log({
      userId: actorId,
      organizationId: orgId,
      action: 'user.restore',
      resource: 'users',
      resourceId: user.id,
      payload: { email: user.email },
    });

    return this.findSafe(user.id);
  }

  private assertFields(dto: CreateUserDto | UpdateUserDto, mode: 'create' | 'update') {
    const errors = validateAdminUserInput({
      email: 'email' in dto ? dto.email : undefined,
      username: dto.username,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
    }, mode);
    const first = Object.values(errors)[0];
    if (first) throw new BadRequestException(first);
  }

  private async assignRoles(userId: string, roleIds: string[]) {
    const roles = await this.roleRepo.findBy({ id: In(roleIds) });
    if (roles.length !== roleIds.length) throw new BadRequestException('نقش نامعتبر');
    await this.userRoleRepo.save(roles.map((r) => this.userRoleRepo.create({ userId, roleId: r.id })));
  }

  private async findSafe(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    return {
      success: true as const,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isActive: user.isActive,
        organizationId: user.organizationId,
        roles: user.userRoles?.map((ur) => ur.role.code) ?? [],
        roleIds: user.userRoles?.map((ur) => ur.roleId) ?? [],
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        lastLoginUserAgent: user.lastLoginUserAgent,
        inactiveReason: user.inactiveReason,
        inactiveAt: user.inactiveAt,
        inactiveBy: user.inactiveBy,
        createdAt: user.createdAt,
      },
    };
  }
}
