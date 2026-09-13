import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/auth.decorators';
import { ApiResponse } from '@city-manager/shared';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();
  private requestCount = 0;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'بررسی سلامت سرویس' })
  check(): ApiResponse<{ status: string; timestamp: string }> {
    this.requestCount += 1;
    return {
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
    };
  }

  /** Kubernetes/Docker liveness — process is up */
  @Public()
  @Get('live')
  live() {
    this.requestCount += 1;
    return { status: 'alive', uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000) };
  }

  /** Readiness — DB connectivity required before traffic */
  @Public()
  @Get('ready')
  async ready() {
    this.requestCount += 1;
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready', database: 'down' });
    }
  }

  /** Minimal Prometheus text exposition for scrape */
  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metrics(): string {
    this.requestCount += 1;
    const uptime = Math.floor((Date.now() - this.startedAt) / 1000);
    const dbUp = this.dataSource.isInitialized ? 1 : 0;
    return [
      '# HELP process_uptime_seconds Process uptime',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${uptime}`,
      '# HELP http_health_requests_total Health endpoint hits',
      '# TYPE http_health_requests_total counter',
      `http_health_requests_total ${this.requestCount}`,
      '# HELP db_up Database pool initialized',
      '# TYPE db_up gauge',
      `db_up ${dbUp}`,
      '',
    ].join('\n');
  }
}
