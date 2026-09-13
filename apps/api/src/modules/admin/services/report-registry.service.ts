import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CUSTOM_REPORT_TEMPLATES,
  DEFAULT_REPORTS,
  ReportDefinition,
  ReportRegistry,
  createReportRegistry,
} from '@city-manager/shared';
import { ReportDefinitionEntity } from '../../analytics/entities/report-definition.entity';

@Injectable()
export class ReportRegistryService implements OnModuleInit {
  private readonly log = new Logger(ReportRegistryService.name);
  private readonly registry: ReportRegistry;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ReportDefinitionEntity)
    private readonly defRepo: Repository<ReportDefinitionEntity>,
  ) {
    this.registry = createReportRegistry(
      DEFAULT_REPORTS.map((definition) => ({
        definition,
        source: 'builtin' as const,
        run: (orgId) => this.runBuiltin(definition.code, orgId),
      })),
    );
  }

  async onModuleInit() {
    try {
      const rows = await this.defRepo.find({ where: { isActive: true } });
      for (const row of rows) {
        this.mountCustom(row.code);
      }
      this.log.log(`Loaded ${rows.length} DB report definition(s)`);
    } catch (err) {
      this.log.warn(`Report catalog load skipped: ${err instanceof Error ? err.message : err}`);
    }
  }

  list(): ReportDefinition[] {
    return this.registry.list();
  }

  listTemplates(): ReportDefinition[] {
    return CUSTOM_REPORT_TEMPLATES.filter((t) => !this.registry.has(t.code));
  }

  get(code: string) {
    return this.registry.get(code);
  }

  async registerTemplate(orgId: string, code: string, userId?: string): Promise<ReportDefinition> {
    const def = CUSTOM_REPORT_TEMPLATES.find((t) => t.code === code);
    if (!def) throw new Error('قالب گزارش سفارشی یافت نشد');

    let row = await this.defRepo.findOne({ where: { organizationId: orgId, code } });
    if (!row) {
      row = this.defRepo.create({
        organizationId: orgId,
        code: def.code,
        name: def.title,
        description: def.description,
        parameters: { category: def.category, source: 'custom' },
        includesPii: false,
        isActive: true,
        createdBy: userId,
      });
    } else {
      row.name = def.title;
      row.description = def.description;
      row.isActive = true;
      row.createdBy = userId ?? row.createdBy;
    }
    await this.defRepo.save(row);
    this.mountCustom(def.code);
    return def;
  }

  async unregisterCustom(orgId: string, code: string): Promise<boolean> {
    const row = await this.defRepo.findOne({ where: { organizationId: orgId, code } });
    if (row) {
      row.isActive = false;
      await this.defRepo.save(row);
    }
    return this.registry.unregister(code);
  }

  private mountCustom(code: string) {
    const def = CUSTOM_REPORT_TEMPLATES.find((t) => t.code === code);
    if (!def || this.registry.has(code)) return;
    this.registry.register({
      definition: def,
      source: 'custom',
      run: (orgId) => this.runCustom(def.code, orgId),
    });
  }

  private orgClause(alias: string, orgId: string | null, startParam = 1): { sql: string; params: string[] } {
    if (!orgId) return { sql: '', params: [] };
    return { sql: ` AND ${alias}organization_id = $${startParam}`, params: [orgId] };
  }

  private async runBuiltin(code: string, orgId: string | null) {
    const orgFilter = this.orgClause('', orgId);
    const params = orgFilter.params;

    switch (code) {
      case 'households_by_status':
        return {
          columns: [
            { key: 'status', label: 'وضعیت' },
            { key: 'count', label: 'تعداد' },
          ],
          rows: await this.dataSource.query(
            `SELECT status, COUNT(*)::int AS count FROM "case".households
             WHERE deleted_at IS NULL${orgFilter.sql} GROUP BY status ORDER BY count DESC`,
            params,
          ),
        };
      case 'household_member_counts':
        return {
          columns: [
            { key: 'bucket', label: 'اندازه خانوار' },
            { key: 'count', label: 'تعداد پرونده' },
            { key: 'avg_members', label: 'میانگین اعضا' },
          ],
          rows: await this.dataSource.query(
            `SELECT
               CASE
                 WHEN member_count = 1 THEN '۱ نفر'
                 WHEN member_count BETWEEN 2 AND 4 THEN '۲–۴ نفر'
                 WHEN member_count BETWEEN 5 AND 7 THEN '۵–۷ نفر'
                 ELSE '۸+ نفر'
               END AS bucket,
               COUNT(*)::int AS count,
               ROUND(AVG(member_count)::numeric, 1) AS avg_members
             FROM "case".households
             WHERE deleted_at IS NULL${orgFilter.sql}
             GROUP BY 1 ORDER BY count DESC`,
            params,
          ),
        };
      case 'fabric_coverage':
        return {
          columns: [
            { key: 'fabric_type', label: 'نوع بافت' },
            { key: 'fabric_count', label: 'تعداد' },
            { key: 'total_area_sqm', label: 'مساحت (m²)' },
          ],
          rows: await this.dataSource.query(
            `SELECT ft.name AS fabric_type, COUNT(f.id)::int AS fabric_count,
                    COALESCE(ROUND(SUM(f.area_sqm)::numeric, 0), 0) AS total_area_sqm
             FROM gis.fabrics f
             JOIN gis.fabric_types ft ON ft.id = f.fabric_type_id
             WHERE f.deleted_at IS NULL${orgId ? ' AND f.organization_id = $1' : ''}
             GROUP BY ft.name ORDER BY total_area_sqm DESC`,
            params,
          ),
        };
      case 'trajectory_event_types':
        return {
          columns: [
            { key: 'event_type', label: 'نوع رویداد' },
            { key: 'count', label: 'تعداد' },
          ],
          rows: await this.dataSource.query(
            `SELECT event_type, COUNT(*)::int AS count
             FROM trajectory.life_trajectory_records
             WHERE deleted_at IS NULL${orgFilter.sql}
             GROUP BY event_type ORDER BY count DESC`,
            params,
          ),
        };
      case 'recent_audit':
        return {
          columns: [
            { key: 'action', label: 'عملیات' },
            { key: 'resource', label: 'منبع' },
            { key: 'count', label: 'تعداد' },
          ],
          rows: await this.dataSource.query(
            `SELECT action, resource, COUNT(*)::int AS count
             FROM audit.audit_logs
             WHERE created_at >= NOW() - INTERVAL '30 days'${orgId ? ' AND organization_id = $1' : ''}
             GROUP BY action, resource ORDER BY count DESC LIMIT 50`,
            params,
          ),
        };
      default:
        throw new Error('این گزارش هنوز پیاده‌سازی نشده');
    }
  }

  private async runCustom(code: string, orgId: string | null) {
    const params = orgId ? [orgId] : [];
    if (code === 'neighborhood_household_counts') {
      return {
        columns: [
          { key: 'neighborhood', label: 'محله' },
          { key: 'count', label: 'تعداد خانوار' },
        ],
        rows: await this.dataSource.query(
          `SELECT COALESCE(n.name, 'بدون محله') AS neighborhood, COUNT(h.id)::int AS count
           FROM "case".households h
           LEFT JOIN gis.neighborhoods n ON n.id = h.neighborhood_id
           WHERE h.deleted_at IS NULL${orgId ? ' AND h.organization_id = $1' : ''}
           GROUP BY 1 ORDER BY count DESC`,
          params,
        ),
      };
    }
    if (code === 'referrals_by_status') {
      return {
        columns: [
          { key: 'status', label: 'وضعیت' },
          { key: 'count', label: 'تعداد' },
        ],
        rows: await this.dataSource.query(
          `SELECT status, COUNT(*)::int AS count
           FROM "case".agency_referrals
           WHERE true${orgId ? ' AND organization_id = $1' : ''}
           GROUP BY status ORDER BY count DESC`,
          params,
        ),
      };
    }
    throw new Error('قالب گزارش سفارشی پیاده‌سازی نشده');
  }
}
