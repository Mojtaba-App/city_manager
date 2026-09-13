import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportSchedulesService } from './report-schedules.service';
import { ReportsExecutionService } from './reports-execution.service';

export interface ReportScheduleWorkerMetrics {
  processedTotal: number;
  failedTotal: number;
  lastTickAt?: string;
  inProcessDisabled: boolean;
}

@Injectable()
export class ReportScheduleWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportScheduleWorkerService.name);
  private timer?: NodeJS.Timeout;
  private processing = false;
  private processedTotal = 0;
  private failedTotal = 0;
  private lastTickAt?: Date;
  private readonly disableInProcess: boolean;
  private readonly intervalMs: number;

  constructor(
    private readonly schedules: ReportSchedulesService,
    private readonly reports: ReportsExecutionService,
    config: ConfigService,
  ) {
    this.disableInProcess = config.get<string>('DISABLE_IN_PROCESS_REPORT_SCHEDULES', 'false') === 'true';
    this.intervalMs = Number(config.get<string>('REPORT_SCHEDULE_INTERVAL_MS', '60000'));
  }

  onModuleInit() {
    if (this.disableInProcess) {
      this.logger.log('In-process report schedule worker disabled (DISABLE_IN_PROCESS_REPORT_SCHEDULES=true)');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, Number.isFinite(this.intervalMs) && this.intervalMs > 0 ? this.intervalMs : 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getMetrics(): ReportScheduleWorkerMetrics {
    return {
      processedTotal: this.processedTotal,
      failedTotal: this.failedTotal,
      lastTickAt: this.lastTickAt?.toISOString(),
      inProcessDisabled: this.disableInProcess,
    };
  }

  async tick(now = new Date()): Promise<{ ran: number; failed: number }> {
    if (this.processing) return { ran: 0, failed: 0 };
    this.processing = true;
    this.lastTickAt = now;
    let ran = 0;
    let failed = 0;
    try {
      const due = await this.schedules.findDue(now);
      for (const row of due) {
        try {
          await this.reports.run(row.organizationId, row.reportCode);
          await this.schedules.markRun(row.organizationId, row.id);
          ran += 1;
          this.processedTotal += 1;
        } catch (err) {
          failed += 1;
          this.failedTotal += 1;
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Report schedule ${row.id} (${row.reportCode}) failed: ${message}`);
        }
      }
    } finally {
      this.processing = false;
    }
    return { ran, failed };
  }
}
