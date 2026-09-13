import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/auth.decorators';
import { Permission } from '@city-manager/shared';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get()
  @Permissions(Permission.ORG_READ)
  @ApiOperation({ summary: 'فهرست سازمان‌ها' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.orgsService.findAll(query);
  }

  @Get(':id')
  @Permissions(Permission.ORG_READ)
  @ApiOperation({ summary: 'جزئیات سازمان' })
  findOne(@Param('id') id: string) {
    return this.orgsService.findOne(id);
  }
}
