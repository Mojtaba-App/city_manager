import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
  ParseUUIDPipe, ForbiddenException, BadRequestException, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions, Public } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audited } from '../../common/decorators/audit.decorator';
import { Permission, JwtPayload, SystemRole } from '@city-manager/shared';
import { UsersService } from '../users/users.service';
import { AdminUsersService } from './services/admin-users.service';
import { RolesService } from './services/roles.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import {
  CreateUserDto, UpdateUserDto, UpdateRoleDto, CreateRoleDto, UpsertSettingDto,
  TestMessagingDto, CreateReportScheduleDto, DeleteUserDto,
} from './dto/admin.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ReportsExecutionService } from './services/reports-execution.service';
import { ReportSchedulesService } from './services/report-schedules.service';
import { ReportRegistryService } from './services/report-registry.service';
import { GlobalSearchService } from './services/global-search.service';

function orgScope(user: JwtPayload): string | null {
  return user.roles.includes(SystemRole.SUPER_ADMIN) ? null : user.orgId;
}

function requireOrg(user: JwtPayload): string {
  if (!user.orgId) throw new ForbiddenException('سازمان کاربر تعریف نشده');
  return user.orgId;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly adminUsers: AdminUsersService,
    private readonly roles: RolesService,
    private readonly dashboard: AdminDashboardService,
    private readonly reportsExec: ReportsExecutionService,
    private readonly reportSchedules: ReportSchedulesService,
    private readonly reportRegistry: ReportRegistryService,
    private readonly globalSearch: GlobalSearchService,
  ) {}

  @Get('dashboard')
  @Permissions(Permission.ORG_READ)
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.dashboard.getStats(orgScope(user));
  }

  @Get('activity')
  @Permissions(Permission.AUDIT_READ)
  getActivity(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.dashboard.getRecentActivity(orgScope(user), limit ? Number(limit) : 30);
  }

  @Get('search')
  @Permissions(Permission.ORG_READ)
  search(@CurrentUser() user: JwtPayload, @Query('q') q = '', @Query('limit') limit?: string) {
    return this.globalSearch.search(requireOrg(user), q, user, limit ? Number(limit) : 20);
  }

  @Get('reports')
  @Permissions(Permission.REPORTS_READ)
  listReports() {
    return { success: true, data: this.reportRegistry.list() };
  }

  @Get('reports/templates')
  @Permissions(Permission.REPORTS_WRITE)
  listReportTemplates() {
    return { success: true, data: this.reportRegistry.listTemplates() };
  }

  @Post('reports/registry')
  @Permissions(Permission.REPORTS_WRITE)
  async registerCustomReport(@CurrentUser() user: JwtPayload, @Body() body: { code?: string }) {
    if (!body?.code) throw new BadRequestException('کد قالب الزامی است');
    try {
      const data = await this.reportRegistry.registerTemplate(requireOrg(user), body.code, user.sub);
      return { success: true, data };
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'ثبت گزارش ناموفق');
    }
  }

  @Delete('reports/registry/:code')
  @Permissions(Permission.REPORTS_WRITE)
  async unregisterCustomReport(@CurrentUser() user: JwtPayload, @Param('code') code: string) {
    try {
      const removed = await this.reportRegistry.unregisterCustom(requireOrg(user), code);
      return { success: true, data: { removed } };
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'حذف گزارش ناموفق');
    }
  }

  @Get('reports/household-status')
  @Permissions(Permission.REPORTS_READ)
  householdStatus(@CurrentUser() user: JwtPayload) {
    return this.dashboard.householdStatusBreakdown(orgScope(user));
  }

  @Get('reports/run/:code')
  @Permissions(Permission.REPORTS_READ)
  runReport(@CurrentUser() user: JwtPayload, @Param('code') code: string) {
    return this.reportsExec.run(orgScope(user), code);
  }

  @Get('reports/run/:code/csv')
  @Permissions(Permission.REPORTS_READ)
  async exportReportCsv(
    @CurrentUser() user: JwtPayload,
    @Param('code') code: string,
    @Res() res: Response,
  ) {
    const result = await this.reportsExec.run(orgScope(user), code);
    const csv = this.reportsExec.toCsv(result.data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${code}.csv"`);
    res.send('\uFEFF' + csv);
  }

  @Get('reports/run/:code/pdf')
  @Permissions(Permission.REPORTS_READ)
  async exportReportPdf(
    @CurrentUser() user: JwtPayload,
    @Param('code') code: string,
    @Res() res: Response,
  ) {
    const result = await this.reportsExec.run(orgScope(user), code);
    const pdf = this.reportsExec.toPdf(result.data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${code}.pdf"`);
    res.send(pdf);
  }

  @Get('report-schedules')
  @Permissions(Permission.REPORTS_READ)
  listReportSchedules(@CurrentUser() user: JwtPayload) {
    return this.reportSchedules.list(requireOrg(user));
  }

  @Post('report-schedules')
  @Permissions(Permission.REPORTS_WRITE)
  createReportSchedule(@CurrentUser() user: JwtPayload, @Body() dto: CreateReportScheduleDto) {
    return this.reportSchedules.create(requireOrg(user), user.sub, dto);
  }

  @Patch('report-schedules/:id/toggle')
  @Permissions(Permission.REPORTS_WRITE)
  toggleReportSchedule(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isEnabled') isEnabled: boolean,
  ) {
    return this.reportSchedules.toggle(requireOrg(user), id, Boolean(isEnabled));
  }

  @Delete('report-schedules/:id')
  @Permissions(Permission.REPORTS_WRITE)
  deleteReportSchedule(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.reportSchedules.remove(requireOrg(user), id);
  }

  @Public()
  @Get('public-branding')
  getPublicBranding() {
    return this.dashboard.getPublicBranding();
  }

  @Get('ui-config')
  getUiConfig(@CurrentUser() user: JwtPayload) {
    return this.dashboard.getUiConfig(user.orgId ?? null);
  }

  @Post('settings/test-database')
  @Permissions(Permission.SETTINGS_READ)
  testDatabase() {
    return this.dashboard.testDatabaseConnection();
  }

  @Post('settings/test-messaging')
  @Permissions(Permission.SETTINGS_READ)
  testMessaging(@CurrentUser() user: JwtPayload, @Body() dto: TestMessagingDto) {
    return this.dashboard.testMessagingConnection(requireOrg(user), dto.channel);
  }

  @Get('settings')
  @Permissions(Permission.SETTINGS_READ)
  listSettings(@CurrentUser() user: JwtPayload) {
    return this.dashboard.listSettings(requireOrg(user));
  }

  @Post('settings')
  @Permissions(Permission.SETTINGS_WRITE)
  @Audited({ action: 'settings.upsert', resource: 'system_setting', severity: 'warning' })
  upsertSetting(@CurrentUser() user: JwtPayload, @Body() dto: UpsertSettingDto) {
    return this.dashboard.upsertSetting(requireOrg(user), user.sub, dto);
  }

  @Get('users')
  @Permissions(Permission.USERS_READ)
  listUsers(@CurrentUser() user: JwtPayload, @Query() query: PaginationQueryDto) {
    return this.users.findAll(query, orgScope(user));
  }

  @Get('users/:id')
  @Permissions(Permission.USERS_READ)
  getUser(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id, orgScope(user));
  }

  @Post('users')
  @Permissions(Permission.USERS_WRITE)
  createUser(@CurrentUser() user: JwtPayload, @Body() dto: CreateUserDto) {
    return this.adminUsers.create(orgScope(user) ?? user.orgId, user.sub, dto);
  }

  @Patch('users/:id')
  @Permissions(Permission.USERS_WRITE)
  updateUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.adminUsers.update(id, orgScope(user), user.sub, dto);
  }

  @Delete('users/:id')
  @Permissions(Permission.USERS_DELETE)
  deleteUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteUserDto,
  ) {
    return this.adminUsers.remove(id, orgScope(user), user.sub, dto.inactiveReason);
  }

  @Get('roles')
  @Permissions(Permission.ROLES_READ)
  listRoles() {
    return this.roles.findAll();
  }

  @Post('roles')
  @Permissions(Permission.ROLES_WRITE)
  createRole(@CurrentUser() user: JwtPayload, @Body() dto: CreateRoleDto) {
    return this.roles.create(user.sub, user.orgId ?? undefined, dto);
  }

  @Get('roles/:id')
  @Permissions(Permission.ROLES_READ)
  getRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.findOne(id);
  }

  @Patch('roles/:id')
  @Permissions(Permission.ROLES_WRITE)
  updateRole(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roles.update(id, user.sub, user.orgId ?? undefined, dto);
  }
}
