import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { User } from './entities/user.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ApiResponse, phoneDigits } from '@city-manager/shared';
import { Permission } from '@city-manager/shared';

function buildUserSearchWhere(
  search: string,
  orgId?: string | null,
): FindOptionsWhere<User>[] {
  const term = search.trim();
  const phoneTerm = phoneDigits(term);
  const base: FindOptionsWhere<User> = orgId ? { organizationId: orgId } : {};
  const conditions: FindOptionsWhere<User>[] = [
    { ...base, email: ILike(`%${term}%`) },
    { ...base, username: ILike(`%${term}%`) },
    { ...base, firstName: ILike(`%${term}%`) },
    { ...base, lastName: ILike(`%${term}%`) },
  ];

  const nameParts = term.split(/\s+/).filter(Boolean);
  if (nameParts.length >= 2) {
    const [first, second] = nameParts;
    conditions.push(
      { ...base, firstName: ILike(`%${first}%`), lastName: ILike(`%${second}%`) },
      { ...base, firstName: ILike(`%${second}%`), lastName: ILike(`%${first}%`) },
    );
  }

  if (phoneTerm.length >= 3) {
    conditions.push({ ...base, phone: ILike(`%${phoneTerm}%`) });
  }

  return conditions;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(
    query: PaginationQueryDto,
    orgId?: string | null,
  ): Promise<ApiResponse<Partial<User>[]>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const search = query.search?.trim();
    const where: FindOptionsWhere<User> | FindOptionsWhere<User>[] = search
      ? buildUserSearchWhere(search, orgId)
      : (orgId ? { organizationId: orgId } : {});

    const [items, total] = await this.userRepo.findAndCount({
      where,
      relations: ['userRoles', 'userRoles.role'],
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        organizationId: true,
        lastLoginAt: true,
        createdAt: true,
      },
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const data = items.map((u) => ({
      ...u,
      roles: u.userRoles?.map((ur) => ur.role.code) ?? [],
      roleIds: u.userRoles?.map((ur) => ur.roleId) ?? [],
    }));

    return { success: true, data, meta: { page, limit, total } };
  }

  async findOne(id: string, orgId?: string | null): Promise<ApiResponse<unknown>> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (!user || (orgId && user.organizationId !== orgId)) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    return {
      success: true,
      data: {
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
        isActive: user.isActive,
        organizationId: user.organizationId,
        roles: user.userRoles.map((ur) => ur.role.code),
        roleIds: user.userRoles.map((ur) => ur.roleId),
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        lastLoginUserAgent: user.lastLoginUserAgent,
        inactiveReason: user.inactiveReason,
        inactiveAt: user.inactiveAt,
        inactiveBy: user.inactiveBy,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async listAssignees(orgId: string): Promise<ApiResponse<Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    displayName: string;
  }>>> {
    const items = await this.userRepo.find({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
      take: 300,
    });
    return {
      success: true,
      data: items.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        displayName: `${u.firstName} ${u.lastName}`.trim() || u.email,
      })),
    };
  }
}

export { Permission, buildUserSearchWhere };
