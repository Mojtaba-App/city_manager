import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Refreshes analytics.mv_neighborhood_kpi on an interval when available.
 * Safe no-op if the materialized view is missing.
 */
@Injectable()
export class KpiSummaryRefreshService implements OnModuleInit {
  private readonly log = new Logger(KpiSummaryRefreshService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit() {
    if (process.env.DISABLE_KPI_SUMMARY_REFRESH === 'true') {
      this.log.log('KPI summary refresh disabled');
      return;
    }
    const ms = Math.max(60_000, Number(process.env.KPI_SUMMARY_REFRESH_MS ?? 300_000));
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), ms);
    this.timer.unref?.();
  }

  async refresh(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.dataSource.query(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_neighborhood_kpi`,
      );
      return { ok: true, message: 'refreshed concurrently' };
    } catch {
      try {
        await this.dataSource.query(`REFRESH MATERIALIZED VIEW analytics.mv_neighborhood_kpi`);
        return { ok: true, message: 'refreshed' };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'refresh failed';
        this.log.warn(`KPI MV refresh skipped: ${message}`);
        return { ok: false, message };
      }
    }
  }

  async listSummary(orgId: string | null, limit = 100) {
    try {
      const params = orgId ? [orgId, limit] : [limit];
      const sql = orgId
        ? `SELECT * FROM analytics.mv_neighborhood_kpi WHERE organization_id = $1 ORDER BY active_households DESC NULLS LAST LIMIT $2`
        : `SELECT * FROM analytics.mv_neighborhood_kpi ORDER BY active_households DESC NULLS LAST LIMIT $1`;
      return await this.dataSource.query(sql, params);
    } catch {
      return [];
    }
  }
}
