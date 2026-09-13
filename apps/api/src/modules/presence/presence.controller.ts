import {
  Controller, Get, Post, Query, UseGuards, BadRequestException, Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, JwtPayload, SystemRole } from '@city-manager/shared';
import { PresenceService } from './presence.service';
import { PresenceStreamService } from './presence-stream.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../users/entities/user.entity';

function orgScope(user: JwtPayload): string | null {
  return user.roles.includes(SystemRole.SUPER_ADMIN) ? null : user.orgId;
}

@ApiTags('presence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PresenceController {
  constructor(
    private readonly presence: PresenceService,
    private readonly stream: PresenceStreamService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Post('presence/heartbeat')
  heartbeat(@CurrentUser() user: JwtPayload) {
    this.presence.touch(user.sub, user.orgId ?? null);
    return { success: true, data: this.presence.snapshot(user.sub) };
  }

  @Get('admin/users/presence')
  @Permissions(Permission.USERS_READ)
  async usersPresence(
    @CurrentUser() user: JwtPayload,
    @Query('ids') idsRaw?: string,
  ) {
    const allowed = await this.resolveAllowedIds(user, idsRaw);
    return {
      success: true,
      data: this.presence.bulk(allowed),
    };
  }

  @Sse('admin/presence/stream')
  @Permissions(Permission.USERS_READ)
  async presenceStream(
    @CurrentUser() user: JwtPayload,
    @Query('ids') idsRaw?: string,
  ) {
    const allowed = await this.resolveAllowedIds(user, idsRaw);
    return this.stream.subscribe(user, allowed, this.presence.bulk(allowed));
  }

  private async resolveAllowedIds(user: JwtPayload, idsRaw?: string): Promise<string[]> {
    const ids = String(idsRaw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      throw new BadRequestException('شناسه کاربر الزامی است');
    }
    if (ids.length > 200) {
      throw new BadRequestException('حداکثر ۲۰۰ کاربر در هر درخواست');
    }

    const scope = orgScope(user);
    const rows = await this.userRepo.find({
      where: { id: In(ids) },
      select: ['id', 'organizationId'],
    });
    return rows
      .filter((row) => !scope || row.organizationId === scope)
      .map((row) => row.id);
  }
}
