import {
  Controller, Get, Post, Patch, Delete, Put, Param, Body, Query, Headers,
  UseGuards, UsePipes, ValidationPipe, ParseUUIDPipe, ForbiddenException, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions, Public } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audited } from '../../common/decorators/audit.decorator';
import { Permission, JwtPayload } from '@city-manager/shared';
import { ConnectorsService } from './services/connectors.service';
import { ConnectionTestService } from './services/connection-test.service';
import { SyncRunnerService } from './services/sync-runner.service';
import { SyncQueueService } from './services/sync-queue.service';
import { WebhookService } from './services/webhook.service';
import { SyncDlqService } from './services/sync-dlq.service';
import {
  CreateConnectorDto, UpdateConnectorDto, UpsertMappingsDto,
} from './dto/integration.dto';

function requireOrg(user: JwtPayload): string {
  if (!user.orgId) throw new ForbiddenException('سازمان کاربر تعریف نشده');
  return user.orgId;
}

function rawBodyFromRequest(req: Request, body: Record<string, unknown>): string {
  const raw = (req as Request & { rawBody?: Buffer | string }).rawBody;
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return JSON.stringify(body ?? {});
}

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationController {
  constructor(
    private readonly connectors: ConnectorsService,
    private readonly tests: ConnectionTestService,
    private readonly runner: SyncRunnerService,
    private readonly queue: SyncQueueService,
    private readonly webhooks: WebhookService,
    private readonly dlq: SyncDlqService,
  ) {}

  @Public()
  @Post('webhooks/:orgId/:code')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Audited({ action: 'webhook.receive', resource: 'webhook', severity: 'warning' })
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: true }))
  receiveWebhookScoped(
    @Param('orgId') orgId: string,
    @Param('code') code: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.webhooks.receive(code, headers, body, rawBodyFromRequest(req, body), orgId);
  }

  @Public()
  @Post('webhooks/:code')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Audited({ action: 'webhook.receive', resource: 'webhook', severity: 'warning' })
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: true }))
  receiveWebhook(
    @Param('code') code: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.webhooks.receive(code, headers, body, rawBodyFromRequest(req, body));
  }

  @Get('connectors')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_READ)
  listConnectors(@CurrentUser() user: JwtPayload) {
    return this.connectors.findAll(requireOrg(user));
  }

  @Get('connectors/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_READ)
  getConnector(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.connectors.findOne(requireOrg(user), id);
  }

  @Post('connectors')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_WRITE)
  createConnector(@CurrentUser() user: JwtPayload, @Body() dto: CreateConnectorDto) {
    return this.connectors.create(requireOrg(user), user.sub, dto);
  }

  @Patch('connectors/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_WRITE)
  updateConnector(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConnectorDto,
  ) {
    return this.connectors.update(requireOrg(user), id, dto);
  }

  @Delete('connectors/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_WRITE)
  deleteConnector(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.connectors.softDelete(requireOrg(user), id);
  }

  @Put('connectors/:id/mappings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_WRITE)
  upsertMappings(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertMappingsDto,
  ) {
    return this.connectors.upsertMappings(requireOrg(user), id, dto);
  }

  @Post('connectors/:id/test')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_EXECUTE)
  testConnection(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.tests.test(requireOrg(user), id, user.sub);
  }

  @Get('connectors/:id/tests')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_READ)
  listTests(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.tests.listTests(requireOrg(user), id);
  }

  @Post('connectors/:id/sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_EXECUTE)
  runSync(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.runner.run(requireOrg(user), id, user.sub, 'manual');
  }

  @Post('connectors/:id/sync/queue')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_EXECUTE)
  queueSync(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.runner.enqueueRetry(requireOrg(user), id, user.sub, this.queue);
  }

  @Get('jobs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_READ)
  listJobs(@CurrentUser() user: JwtPayload, @Query('connectorId') connectorId?: string) {
    return this.runner.listJobs(requireOrg(user), connectorId);
  }

  @Get('jobs/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_READ)
  getJob(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.runner.getJob(requireOrg(user), id);
  }

  @Get('queue')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_READ)
  listQueue(@CurrentUser() user: JwtPayload) {
    return this.queue.list(requireOrg(user));
  }

  @Get('queue/metrics')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_READ)
  async queueMetrics(@CurrentUser() user: JwtPayload) {
    return { success: true, data: await this.queue.getMetrics(requireOrg(user)) };
  }

  @Post('queue/process')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_EXECUTE)
  async processQueue() {
    await this.queue.tick();
    return { success: true, data: { processed: true } };
  }

  @Get('dlq')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_READ)
  listDlq(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.dlq.list(requireOrg(user), limit ? Number(limit) : 50);
  }

  @Post('dlq/:id/requeue')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_EXECUTE)
  requeueDlq(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.dlq.requeue(requireOrg(user), id, user.sub);
  }

  @Get('webhooks/events')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_READ)
  listWebhookEvents(@CurrentUser() user: JwtPayload, @Query('connectorId') connectorId?: string) {
    return this.webhooks.listEvents(requireOrg(user), connectorId);
  }

  @Get('docs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Permissions(Permission.INTEGRATION_READ)
  docs(@CurrentUser() user: JwtPayload) {
    return {
      success: true,
      data: {
        organizationId: requireOrg(user),
        endpoints: [
          { method: 'GET', path: '/integrations/connectors', desc: 'فهرست کانکتورها' },
          { method: 'POST', path: '/integrations/connectors', desc: 'ایجاد کانکتور' },
          { method: 'GET', path: '/integrations/connectors/:id', desc: 'جزئیات کانکتور و نگاشت‌ها' },
          { method: 'PATCH', path: '/integrations/connectors/:id', desc: 'ویرایش کانکتور' },
          { method: 'DELETE', path: '/integrations/connectors/:id', desc: 'حذف نرم کانکتور' },
          { method: 'PUT', path: '/integrations/connectors/:id/mappings', desc: 'ذخیره نگاشت فیلدها' },
          { method: 'POST', path: '/integrations/connectors/:id/test', desc: 'تست اتصال' },
          { method: 'GET', path: '/integrations/connectors/:id/tests', desc: 'تاریخچه تست اتصال' },
          { method: 'POST', path: '/integrations/connectors/:id/sync', desc: 'اجرای همگام‌سازی دستی' },
          { method: 'POST', path: '/integrations/connectors/:id/sync/queue', desc: 'افزودن همگام‌سازی به صف Retry' },
          { method: 'GET', path: '/integrations/jobs', desc: 'فهرست جاب‌های sync' },
          { method: 'GET', path: '/integrations/jobs/:id', desc: 'جزئیات جاب و لاگ‌ها' },
          { method: 'GET', path: '/integrations/queue', desc: 'صف Retry' },
          { method: 'GET', path: '/integrations/queue/metrics', desc: 'متریک صف' },
          { method: 'POST', path: '/integrations/queue/process', desc: 'اجرای فوری tick صف/زمان‌بندی' },
          { method: 'GET', path: '/integrations/dlq', desc: 'Dead Letter Queue رکوردهای ناموفق' },
          { method: 'POST', path: '/integrations/dlq/:id/requeue', desc: 'بازگردانی آیتم DLQ به صف' },
          { method: 'GET', path: '/integrations/webhooks/events', desc: 'رویدادهای webhook دریافتی' },
          { method: 'POST', path: '/integrations/webhooks/:orgId/:code', desc: 'دریافت webhook (بدون JWT، توصیه‌شده)' },
          { method: 'POST', path: '/integrations/webhooks/:code', desc: 'دریافت webhook legacy (اگر code یکتا باشد)' },
        ],
        authNotes: [
          'مسیرها نسبت به پایه API (مثلاً /api/v1) هستند؛ لینک کامل در UI ساخته می‌شود',
          'رمزها و توکن‌ها با AES-256-GCM رمزنگاری می‌شوند',
          'Webhook می‌تواند با هدر x-signature / x-hub-signature-256 (HMAC-SHA256) امضا شود',
          'Retry با backoff نمایی طبق retry policy همان کانکتور انجام می‌شود',
          'همگام‌سازی زمان‌بندی‌شده با scheduleIntervalMinutes کار می‌کند',
          'targetEntity=household|member|dwelling به‌صورت واقعی upsert می‌شود و در external_id_mappings لینک می‌گردد',
          'کانکتور csv_file از csvUrl یا csvText در connectionConfig می‌خواند',
          'رکوردهای ناموفق به DLQ می‌روند و قابل requeue هستند',
        ],
      },
    };
  }
}
