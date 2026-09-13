import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/auth.decorators';
import { Permission, JwtPayload } from '@city-manager/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SystemRole } from '@city-manager/shared';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions(Permission.USERS_READ)
  @ApiOperation({ summary: 'فهرست کاربران' })
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const orgScope = user.roles.includes(SystemRole.SUPER_ADMIN)
      ? null
      : user.orgId;
    return this.usersService.findAll(query, orgScope);
  }

  @Get(':id')
  @Permissions(Permission.USERS_READ)
  @ApiOperation({ summary: 'جزئیات کاربر' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const orgScope = user.roles.includes(SystemRole.SUPER_ADMIN)
      ? null
      : user.orgId;
    return this.usersService.findOne(id, orgScope);
  }
}
