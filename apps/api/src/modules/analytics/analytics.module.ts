import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { KpiDefinition } from './entities/kpi-definition.entity';
import { ReportSnapshot } from './entities/report-snapshot.entity';
import { AnalyticsQueryService } from './services/analytics-query.service';
import { AnalyticsSpatialService } from './services/analytics-spatial.service';
import { AnalyticsKpiService } from './services/analytics-kpi.service';
import { AnalyticsExportService } from './services/analytics-export.service';
import { KpiSummaryRefreshService } from './services/kpi-summary-refresh.service';
import { ReportDefinitionEntity } from './entities/report-definition.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KpiDefinition, ReportSnapshot, ReportDefinitionEntity])],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsQueryService,
    AnalyticsSpatialService,
    AnalyticsKpiService,
    AnalyticsExportService,
    KpiSummaryRefreshService,
  ],
  exports: [AnalyticsQueryService, KpiSummaryRefreshService],
})
export class AnalyticsModule {}
