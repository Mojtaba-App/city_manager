import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpiDefinition } from '../entities/kpi-definition.entity';
import { ReportSnapshot } from '../entities/report-snapshot.entity';
import { DEFAULT_KPI_DEFINITIONS, KpiDefinitionConfig } from '@city-manager/shared';
import { KpiConfigItemDto } from '../dto/analytics.dto';
import { AnalyticsQueryService } from './analytics-query.service';
import { AnalyticsFilterDto } from '../dto/analytics.dto';

@Injectable()
export class AnalyticsKpiService {
  constructor(
    @InjectRepository(KpiDefinition)
    private readonly kpiRepo: Repository<KpiDefinition>,
    @InjectRepository(ReportSnapshot)
    private readonly snapshotRepo: Repository<ReportSnapshot>,
    private readonly query: AnalyticsQueryService,
  ) {}

  async getConfig(orgId: string): Promise<{ success: true; data: KpiDefinitionConfig[] }> {
    const rows = await this.kpiRepo.find({
      where: { organizationId: orgId },
      order: { sortOrder: 'ASC' },
    });
    if (!rows.length) {
      return { success: true, data: DEFAULT_KPI_DEFINITIONS };
    }
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        metric: r.metric,
        enabled: r.enabled,
        sortOrder: r.sortOrder,
        group: 'عمومی',
      })),
    };
  }

  async saveConfig(orgId: string, items: KpiConfigItemDto[]) {
    for (const item of items) {
      let row = await this.kpiRepo.findOne({ where: { organizationId: orgId, code: item.code } });
      if (!row) {
        row = this.kpiRepo.create({
          organizationId: orgId,
          code: item.code,
          title: item.title,
          metric: item.metric,
          enabled: item.enabled,
          sortOrder: item.sortOrder,
        });
      } else {
        row.title = item.title;
        row.metric = item.metric;
        row.enabled = item.enabled;
        row.sortOrder = item.sortOrder;
      }
      await this.kpiRepo.save(row);
    }
    return this.getConfig(orgId);
  }

  async saveSnapshot(
    orgId: string,
    userId: string,
    reportCode: string,
    filters: AnalyticsFilterDto,
    resultData: Record<string, unknown>,
    periodLabel?: string,
  ) {
    const saved = await this.snapshotRepo.save(
      this.snapshotRepo.create({
        organizationId: orgId,
        reportCode,
        periodLabel,
        parameters: filters as unknown as Record<string, unknown>,
        resultData,
        generatedBy: userId,
      }),
    );
    return { success: true, data: saved };
  }

  async listSnapshots(orgId: string, limit = 20) {
    const data = await this.snapshotRepo.find({
      where: { organizationId: orgId },
      order: { generatedAt: 'DESC' },
      take: limit,
    });
    return { success: true, data };
  }
}
