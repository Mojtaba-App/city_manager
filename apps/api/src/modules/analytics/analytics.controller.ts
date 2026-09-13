import {
  Controller, Get, Post, Put, Body, Query, Res, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, JwtPayload, SystemRole } from '@city-manager/shared';
import { AnalyticsQueryService } from './services/analytics-query.service';
import { AnalyticsSpatialService } from './services/analytics-spatial.service';
import { AnalyticsKpiService } from './services/analytics-kpi.service';
import { AnalyticsExportService } from './services/analytics-export.service';
import { AnalyticsFilterDto, SaveKpiConfigDto, ExportAnalyticsDto } from './dto/analytics.dto';

function orgScope(user: JwtPayload): string | null {
  return user.roles.includes(SystemRole.SUPER_ADMIN) ? null : user.orgId;
}

function requireOrg(user: JwtPayload): string {
  if (!user.orgId) throw new ForbiddenException('سازمان کاربر تعریف نشده');
  return user.orgId;
}

function parseList(v?: string | string[]): string[] | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return v;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

function filtersFromQuery(q: Record<string, string | undefined>): AnalyticsFilterDto {
  return {
    neighborhoodIds: parseList(q.neighborhoodIds),
    householdStatuses: parseList(q.householdStatuses),
    ownershipTypes: parseList(q.ownershipTypes),
    educationLevels: parseList(q.educationLevels),
    employmentStatuses: parseList(q.employmentStatuses),
    incomeMin: q.incomeMin ? Number(q.incomeMin) : undefined,
    incomeMax: q.incomeMax ? Number(q.incomeMax) : undefined,
    fromDate: q.fromDate,
    toDate: q.toDate,
    memberRole: q.memberRole,
  };
}

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly query: AnalyticsQueryService,
    private readonly spatial: AnalyticsSpatialService,
    private readonly kpis: AnalyticsKpiService,
    private readonly exportSvc: AnalyticsExportService,
  ) {}

  @Get('overview')
  @Permissions(Permission.REPORTS_READ)
  async overview(@CurrentUser() user: JwtPayload, @Query() q: Record<string, string>) {
    const data = await this.query.overview(orgScope(user), filtersFromQuery(q));
    return { success: true, data };
  }

  @Get('distributions')
  @Permissions(Permission.REPORTS_READ)
  async allDistributions(@CurrentUser() user: JwtPayload, @Query() q: Record<string, string>) {
    const f = filtersFromQuery(q);
    const org = orgScope(user);
    const [income, education, employment, ownership] = await Promise.all([
      this.query.incomeDistribution(org, f),
      this.query.educationDistribution(org, f),
      this.query.employmentDistribution(org, f),
      this.query.ownershipDistribution(org, f),
    ]);
    return { success: true, data: { income, education, employment, ownership } };
  }

  @Get('timeseries')
  @Permissions(Permission.REPORTS_READ)
  async timeseries(@CurrentUser() user: JwtPayload, @Query() q: Record<string, string>) {
    const f = filtersFromQuery(q);
    const org = orgScope(user);
    const [householdsRegistered, trajectoryEvents] = await Promise.all([
      this.query.householdTimeSeries(org, f),
      this.query.trajectoryTimeSeries(org, f),
    ]);
    return { success: true, data: { householdsRegistered, trajectoryEvents } };
  }

  @Get('spatial/heatmap')
  @Permissions(Permission.REPORTS_READ)
  heatmap(@CurrentUser() user: JwtPayload, @Query() q: Record<string, string>) {
    return this.spatial.vulnerabilityHeatmap(orgScope(user), filtersFromQuery(q));
  }

  @Get('spatial/neighborhoods')
  @Permissions(Permission.REPORTS_READ)
  choropleth(@CurrentUser() user: JwtPayload, @Query() q: Record<string, string>) {
    return this.spatial.neighborhoodChoropleth(orgScope(user), filtersFromQuery(q));
  }

  @Get('filters')
  @Permissions(Permission.REPORTS_READ)
  filterOptions(@CurrentUser() user: JwtPayload) {
    return this.query.filterOptions(orgScope(user));
  }

  @Get('kpis/config')
  @Permissions(Permission.REPORTS_READ)
  getKpiConfig(@CurrentUser() user: JwtPayload) {
    return this.kpis.getConfig(requireOrg(user));
  }

  @Put('kpis/config')
  @Permissions(Permission.REPORTS_WRITE)
  saveKpiConfig(@CurrentUser() user: JwtPayload, @Body() dto: SaveKpiConfigDto) {
    return this.kpis.saveConfig(requireOrg(user), dto.items);
  }

  @Get('snapshots')
  @Permissions(Permission.REPORTS_READ)
  snapshots(@CurrentUser() user: JwtPayload) {
    return this.kpis.listSnapshots(requireOrg(user));
  }

  @Post('snapshots')
  @Permissions(Permission.REPORTS_WRITE)
  async createSnapshot(@CurrentUser() user: JwtPayload, @Body() dto: ExportAnalyticsDto) {
    const overview = await this.query.overview(orgScope(user), dto.filters ?? {});
    return this.kpis.saveSnapshot(
      requireOrg(user),
      user.sub,
      'analytics_overview',
      dto.filters ?? {},
      overview as unknown as Record<string, unknown>,
      dto.title,
    );
  }

  @Post('export/csv')
  @Permissions(Permission.REPORTS_READ)
  async exportCsv(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ExportAnalyticsDto,
    @Res() res: Response,
  ) {
    const overview = await this.query.overview(orgScope(user), dto.filters ?? {});
    const csv = this.exportSvc.buildCsv(overview);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics-report.csv"');
    res.send(csv);
  }

  @Post('export/excel')
  @Permissions(Permission.REPORTS_READ)
  async exportExcel(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ExportAnalyticsDto,
    @Res() res: Response,
  ) {
    const overview = await this.query.overview(orgScope(user), dto.filters ?? {});
    const xml = this.exportSvc.buildExcelXml(overview, dto.title ?? 'گزارش تحلیلی');
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics-report.xls"');
    res.send(xml);
  }

  @Post('export/pdf')
  @Permissions(Permission.REPORTS_READ)
  async exportPdf(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ExportAnalyticsDto,
    @Res() res: Response,
  ) {
    const overview = await this.query.overview(orgScope(user), dto.filters ?? {});
    const title = dto.title ?? 'گزارش تحلیلی مدیران شهری';
    const pdf = this.exportSvc.buildPdf(overview, title);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics-report.pdf"');
    res.send(pdf);
  }

  @Post('export/pdf-html')
  @Permissions(Permission.REPORTS_READ)
  async exportPdfHtml(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ExportAnalyticsDto,
    @Res() res: Response,
  ) {
    const overview = await this.query.overview(orgScope(user), dto.filters ?? {});
    const html = this.exportSvc.buildPdfHtml(overview, dto.title ?? 'گزارش تحلیلی مدیران شهری');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
