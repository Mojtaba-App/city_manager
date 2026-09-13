import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../users/entities/role.entity';
import { CreateRoleDto, UpdateRoleDto } from '../dto/admin.dto';
import { ROLE_LABELS, ROLE_PERMISSIONS, SystemRole } from '@city-manager/shared';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    const roles = await this.roleRepo.find({ order: { code: 'ASC' } });
    return {
      success: true,
      data: roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name || ROLE_LABELS[r.code as SystemRole] || r.code,
        description: r.description,
        permissions: r.permissions,
        isSystem: r.isSystem,
        organizationId: r.organizationId ?? null,
        defaultPermissions: ROLE_PERMISSIONS[r.code as SystemRole] ?? [],
      })),
    };
  }

  async findOne(id: string) {
    const r = await this.roleRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('نقش یافت نشد');
    return {
      success: true,
      data: {
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        permissions: r.permissions,
        isSystem: r.isSystem,
        organizationId: r.organizationId ?? null,
      },
    };
  }

  async create(actorId: string, orgId: string | undefined, dto: CreateRoleDto) {
    const code = dto.code.trim().toLowerCase().replace(/\s+/g, '_');
    if (!/^[a-z][a-z0-9_]{1,48}$/.test(code)) {
      throw new BadRequestException('کد نقش باید لاتین، با حرف شروع شود و حداکثر ۵۰ کاراکتر باشد');
    }
    if (Object.values(SystemRole).includes(code as SystemRole)) {
      throw new ConflictException('کد نقش سیستمی قابل ایجاد مجدد نیست');
    }
    const exists = await this.roleRepo.findOne({ where: { code } });
    if (exists) throw new ConflictException('کد نقش تکراری است');

    const role = await this.roleRepo.save(
      this.roleRepo.create({
        code,
        name: dto.name.trim(),
        description: dto.description,
        permissions: dto.permissions ?? [],
        isSystem: false,
        organizationId: orgId ?? null,
      }),
    );

    await this.audit.log({
      userId: actorId,
      organizationId: orgId,
      action: 'role.create',
      resource: 'roles',
      resourceId: role.id,
      payload: { code, permissionsCount: role.permissions?.length },
    });

    return this.findOne(role.id);
  }

  async update(id: string, actorId: string, orgId: string | undefined, dto: UpdateRoleDto) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('نقش یافت نشد');
    if (role.code === SystemRole.SUPER_ADMIN) {
      throw new ForbiddenException('نقش مدیر کل قابل تغییر نیست');
    }

    if (dto.name != null) role.name = dto.name;
    if (dto.description != null) role.description = dto.description;
    if (dto.permissions != null) role.permissions = dto.permissions;

    await this.roleRepo.save(role);

    await this.audit.log({
      userId: actorId,
      organizationId: orgId,
      action: 'role.update',
      resource: 'roles',
      resourceId: id,
      payload: { permissionsCount: role.permissions?.length },
    });

    return this.findOne(id);
  }
}
