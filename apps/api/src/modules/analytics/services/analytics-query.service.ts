import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  AnalyticsFilter, DistributionBucket, TimeSeriesPoint, AnalyticsKpi,
  AnalyticsOverview, INCOME_BANDS,
} from '@city-manager/shared';
import { AnalyticsFilterDto } from '../dto/analytics.dto';

@Injectable()
export class AnalyticsQueryService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async overview(orgId: string | null, filters: AnalyticsFilterDto = {}): Promise<AnalyticsOverview> {
    const [kpis, income, education, employment, ownership, hhTs, trajTs] = await Promise.all([
      this.computeKpis(orgId, filters),
      this.incomeDistribution(orgId, filters),
      this.educationDistribution(orgId, filters),
      this.employmentDistribution(orgId, filters),
      this.ownershipDistribution(orgId, filters),
      this.householdTimeSeries(orgId, filters),
      this.trajectoryTimeSeries(orgId, filters),
    ]);

    return {
      filters: filters as AnalyticsFilter,
      kpis,
      distributions: { income, education, employment, ownership },
      timeSeries: {
        householdsRegistered: hhTs,
        trajectoryEvents: trajTs,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async computeKpis(orgId: string | null, filters: AnalyticsFilterDto): Promise<AnalyticsKpi[]> {
    const { clause, params } = this.buildHouseholdWhere(orgId, filters, 'h');
    const memberJoin = `
      FROM "case".households h
      LEFT JOIN "case".family_members fm ON fm.household_id = h.id AND fm.deleted_at IS NULL
      LEFT JOIN "case".ownership_records o ON o.household_id = h.id AND o.is_current = true
      WHERE h.deleted_at IS NULL ${clause}
    `;

    const rows = await this.safeQuery(`
      SELECT
        COUNT(DISTINCT h.id)::int AS households_total,
        COUNT(DISTINCT h.id) FILTER (WHERE h.status = 'active')::int AS households_active,
        COUNT(DISTINCT fm.id)::int AS members_total,
        AVG(fm.monthly_income)::float AS avg_income,
        COUNT(DISTINCT fm.id) FILTER (WHERE fm.employment_status = 'unemployed')::float AS unemployed,
        COUNT(DISTINCT fm.id) FILTER (WHERE fm.employment_status IS NOT NULL)::float AS employment_known,
        COUNT(DISTINCT h.id) FILTER (WHERE o.ownership_type = 'tenant')::float AS tenants,
        COUNT(DISTINCT h.id) FILTER (WHERE o.ownership_type IS NOT NULL)::float AS ownership_known,
        AVG(COALESCE((h.custom_fields->>'vulnerabilityScore')::float, NULL))::float AS avg_vulnerability
      ${memberJoin}
    `, params);

    const r = rows[0] ?? {};
    const unemploymentRate = r.employment_known > 0
      ? Math.round((r.unemployed / r.employment_known) * 1000) / 10
      : 0;
    const tenantRate = r.ownership_known > 0
      ? Math.round((r.tenants / r.ownership_known) * 1000) / 10
      : 0;

    let trajCount = 0;
    try {
      const { clause: tc, params: tp } = this.buildOrgDateWhere(orgId, filters, 't', 'event_date');
      const tr = await this.ds.query(`
        SELECT COUNT(*)::int AS c FROM trajectory.life_trajectory_records t
        WHERE t.deleted_at IS NULL ${tc}
      `, tp);
      trajCount = Number(tr[0]?.c ?? 0);
    } catch { /* */ }

    const metricValues: Record<string, AnalyticsKpi> = {
      households_total: {
        id: 'kpi-hh-total', code: 'households_total', title: 'کل خانوارها',
        value: Number(r.households_total ?? 0), format: 'number',
      },
      households_active: {
        id: 'kpi-hh-active', code: 'households_active', title: 'خانوار فعال',
        value: Number(r.households_active ?? 0), format: 'number',
      },
      members_total: {
        id: 'kpi-members', code: 'members_total', title: 'کل اعضا',
        value: Number(r.members_total ?? 0), format: 'number',
      },
      avg_income: {
        id: 'kpi-avg-income', code: 'avg_income', title: 'میانگین درآمد',
        value: Math.round(Number(r.avg_income ?? 0)), format: 'currency', unit: 'ریال',
      },
      unemployment_rate: {
        id: 'kpi-unemployed', code: 'unemployment_rate', title: 'نرخ بیکاری',
        value: unemploymentRate, format: 'percent', unit: '%',
      },
      tenant_rate: {
        id: 'kpi-tenant', code: 'tenant_rate', title: 'نسبت مستأجر',
        value: tenantRate, format: 'percent', unit: '%',
      },
      avg_vulnerability: {
        id: 'kpi-vuln', code: 'avg_vulnerability', title: 'میانگین آسیب‌پذیری',
        value: r.avg_vulnerability != null ? Math.round(Number(r.avg_vulnerability) * 10) / 10 : '—',
        format: 'number', description: 'از فیلد custom vulnerabilityScore',
      },
      trajectory_events: {
        id: 'kpi-traj', code: 'trajectory_events', title: 'رویداد خط سیر',
        value: trajCount, format: 'number',
      },
    };

    return Object.values(metricValues);
  }

  async incomeDistribution(orgId: string | null, filters: AnalyticsFilterDto): Promise<DistributionBucket[]> {
    const { clause, params } = this.buildHouseholdWhere(orgId, filters, 'h');
    const rows = await this.safeQuery(`
      SELECT
        CASE
          WHEN fm.monthly_income IS NULL THEN 'unknown'
          WHEN fm.monthly_income < 5000000 THEN 'u5m'
          WHEN fm.monthly_income < 10000000 THEN '5_10m'
          WHEN fm.monthly_income < 20000000 THEN '10_20m'
          WHEN fm.monthly_income < 40000000 THEN '20_40m'
          ELSE 'o40m'
        END AS band,
        COUNT(*)::int AS count
      FROM "case".family_members fm
      JOIN "case".households h ON h.id = fm.household_id
      WHERE fm.deleted_at IS NULL AND h.deleted_at IS NULL ${clause}
      ${filters.memberRole ? `AND fm.member_role = $${params.length + 1}` : ''}
      GROUP BY 1
    `, filters.memberRole ? [...params, filters.memberRole] : params);

    return this.toBuckets(rows, INCOME_BANDS.map((b) => ({ key: b.key, label: b.label })));
  }

  async educationDistribution(orgId: string | null, filters: AnalyticsFilterDto): Promise<DistributionBucket[]> {
    const { clause, params } = this.buildHouseholdWhere(orgId, filters, 'h');
    const rows = await this.safeQuery(`
      SELECT COALESCE(fm.education_level, 'unknown') AS key, COUNT(*)::int AS count
      FROM "case".family_members fm
      JOIN "case".households h ON h.id = fm.household_id
      WHERE fm.deleted_at IS NULL AND h.deleted_at IS NULL ${clause}
      ${filters.educationLevels?.length ? `AND fm.education_level = ANY($${params.length + 1})` : ''}
      GROUP BY 1 ORDER BY count DESC
    `, filters.educationLevels?.length ? [...params, filters.educationLevels] : params);

    const labels: Record<string, string> = {
      none: 'بی‌سواد', primary: 'ابتدایی', middle: 'متوسطه', high_school: 'دبیرستان',
      diploma: 'دیپلم', associate: 'کاردانی', bachelor: 'کارشناسی', master: 'ارشد',
      doctorate: 'دکتری', other: 'سایر', unknown: 'نامشخص',
    };
    return this.toBuckets(rows.map((r: { key: string; count: number }) => ({
      band: r.key, count: r.count,
    })), Object.entries(labels).map(([key, label]) => ({ key, label })));
  }

  async employmentDistribution(orgId: string | null, filters: AnalyticsFilterDto): Promise<DistributionBucket[]> {
    const { clause, params } = this.buildHouseholdWhere(orgId, filters, 'h');
    const empFilter = filters.employmentStatuses?.length
      ? `AND fm.employment_status = ANY($${params.length + 1})`
      : '';
    const rows = await this.safeQuery(`
      SELECT COALESCE(fm.employment_status, 'unknown') AS key, COUNT(*)::int AS count
      FROM "case".family_members fm
      JOIN "case".households h ON h.id = fm.household_id
      WHERE fm.deleted_at IS NULL AND h.deleted_at IS NULL ${clause}
      ${empFilter}
      GROUP BY 1 ORDER BY count DESC
    `, filters.employmentStatuses?.length ? [...params, filters.employmentStatuses] : params);

    const labels: Record<string, string> = {
      employed: 'شاغل', self_employed: 'خویش‌فرما', unemployed: 'بیکار', student: 'دانشجو',
      retired: 'بازنشسته', homemaker: 'خانه‌دار', disabled: 'ازکارافتاده', other: 'سایر', unknown: 'نامشخص',
    };
    return this.toBuckets(rows.map((r: { key: string; count: number }) => ({
      band: r.key, count: r.count,
    })), Object.entries(labels).map(([key, label]) => ({ key, label })));
  }

  async ownershipDistribution(orgId: string | null, filters: AnalyticsFilterDto): Promise<DistributionBucket[]> {
    const { clause, params } = this.buildHouseholdWhere(orgId, filters, 'h');
    const rows = await this.safeQuery(`
      SELECT COALESCE(o.ownership_type, 'unknown') AS key, COUNT(DISTINCT h.id)::int AS count
      FROM "case".households h
      LEFT JOIN "case".ownership_records o ON o.household_id = h.id AND o.is_current = true
      WHERE h.deleted_at IS NULL ${clause}
      GROUP BY 1 ORDER BY count DESC
    `, params);

    const labels: Record<string, string> = {
      owner: 'مالک', tenant: 'مستأجر', rent_free: 'بدون اجاره',
      cooperative: 'تعاونی', no_deed: 'فاقد سند', shared: 'مشاعی',
      other: 'سایر', unknown: 'نامشخص',
    };
    return this.toBuckets(rows.map((r: { key: string; count: number }) => ({
      band: r.key, count: r.count,
    })), Object.entries(labels).map(([key, label]) => ({ key, label })));
  }

  async householdTimeSeries(orgId: string | null, filters: AnalyticsFilterDto): Promise<TimeSeriesPoint[]> {
    const { clause, params } = this.buildHouseholdWhere(orgId, filters, 'h');
    const rows = await this.safeQuery(`
      SELECT to_char(date_trunc('month', h.registered_at::timestamp), 'YYYY-MM') AS period,
             COUNT(*)::int AS value
      FROM "case".households h
      WHERE h.deleted_at IS NULL ${clause}
      GROUP BY 1 ORDER BY 1
    `, params);
    return rows.map((r: { period: string; value: number }) => ({
      period: r.period,
      label: r.period,
      value: Number(r.value),
    }));
  }

  async trajectoryTimeSeries(orgId: string | null, filters: AnalyticsFilterDto): Promise<TimeSeriesPoint[]> {
    try {
      const { clause, params } = this.buildOrgDateWhere(orgId, filters, 't', 'event_date');
      const rows = await this.ds.query(`
        SELECT to_char(date_trunc('month', t.event_date::timestamp), 'YYYY-MM') AS period,
               COUNT(*)::int AS value
        FROM trajectory.life_trajectory_records t
        WHERE t.deleted_at IS NULL ${clause}
        GROUP BY 1 ORDER BY 1
      `, params);
      return rows.map((r: { period: string; value: number }) => ({
        period: r.period,
        label: r.period,
        value: Number(r.value),
      }));
    } catch {
      return [];
    }
  }

  async filterOptions(orgId: string | null) {
    const params = orgId ? [orgId] : [];
    const orgClause = orgId ? 'AND organization_id = $1' : '';
    let neighborhoods: Array<{ id: string; name: string }> = [];
    try {
      neighborhoods = await this.ds.query(`
        SELECT id, name FROM program.neighborhoods
        WHERE deleted_at IS NULL ${orgClause}
        ORDER BY name
      `, params);
    } catch { /* */ }

    return {
      success: true,
      data: {
        neighborhoods,
        householdStatuses: [
          { key: 'draft', label: 'پیش‌نویس' },
          { key: 'active', label: 'فعال' },
          { key: 'suspended', label: 'معلق' },
          { key: 'graduated', label: 'فارغ‌التحصیل' },
          { key: 'withdrawn', label: 'انصراف' },
          { key: 'archived', label: 'بایگانی' },
        ],
        ownershipTypes: [
          { key: 'owner', label: 'مالک' },
          { key: 'tenant', label: 'مستأجر' },
          { key: 'rent_free', label: 'بدون اجاره' },
          { key: 'cooperative', label: 'تعاونی' },
          { key: 'no_deed', label: 'فاقد سند' },
          { key: 'shared', label: 'مشاعی' },
          { key: 'other', label: 'سایر' },
        ],
        educationLevels: [
          { key: 'none', label: 'بی‌سواد' },
          { key: 'primary', label: 'ابتدایی' },
          { key: 'middle', label: 'متوسطه' },
          { key: 'high_school', label: 'دبیرستان' },
          { key: 'diploma', label: 'دیپلم' },
          { key: 'associate', label: 'کاردانی' },
          { key: 'bachelor', label: 'کارشناسی' },
          { key: 'master', label: 'ارشد' },
          { key: 'doctorate', label: 'دکتری' },
          { key: 'other', label: 'سایر' },
        ],
        employmentStatuses: [
          { key: 'employed', label: 'شاغل' },
          { key: 'self_employed', label: 'خویش‌فرما' },
          { key: 'unemployed', label: 'بیکار' },
          { key: 'student', label: 'دانشجو' },
          { key: 'retired', label: 'بازنشسته' },
          { key: 'homemaker', label: 'خانه‌دار' },
          { key: 'disabled', label: 'ازکارافتاده' },
          { key: 'other', label: 'سایر' },
        ],
      },
    };
  }

  private buildHouseholdWhere(orgId: string | null, filters: AnalyticsFilterDto, alias: string) {
    const parts: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (orgId) {
      parts.push(`AND ${alias}.organization_id = $${i++}`);
      params.push(orgId);
    }
    if (filters.neighborhoodIds?.length) {
      parts.push(`AND ${alias}.neighborhood_id = ANY($${i++})`);
      params.push(filters.neighborhoodIds);
    }
    if (filters.householdStatuses?.length) {
      parts.push(`AND ${alias}.status = ANY($${i++})`);
      params.push(filters.householdStatuses);
    }
    if (filters.fromDate) {
      parts.push(`AND ${alias}.registered_at >= $${i++}::date`);
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      parts.push(`AND ${alias}.registered_at < ($${i++}::date + interval '1 day')`);
      params.push(filters.toDate);
    }
    if (filters.ownershipTypes?.length) {
      parts.push(`AND EXISTS (
        SELECT 1 FROM "case".ownership_records ox
        WHERE ox.household_id = ${alias}.id AND ox.is_current = true
          AND ox.ownership_type = ANY($${i++})
      )`);
      params.push(filters.ownershipTypes);
    }
    if (filters.incomeMin != null || filters.incomeMax != null) {
      const lo = filters.incomeMin ?? 0;
      const hi = filters.incomeMax ?? 999999999;
      parts.push(`AND EXISTS (
        SELECT 1 FROM "case".family_members fx
        WHERE fx.household_id = ${alias}.id AND fx.deleted_at IS NULL
          AND fx.monthly_income BETWEEN $${i++} AND $${i++}
      )`);
      params.push(lo, hi);
    }
    if (filters.educationLevels?.length) {
      parts.push(`AND EXISTS (
        SELECT 1 FROM "case".family_members fx
        WHERE fx.household_id = ${alias}.id AND fx.deleted_at IS NULL
          AND fx.education_level = ANY($${i++})
      )`);
      params.push(filters.educationLevels);
    }
    if (filters.employmentStatuses?.length) {
      parts.push(`AND EXISTS (
        SELECT 1 FROM "case".family_members fx
        WHERE fx.household_id = ${alias}.id AND fx.deleted_at IS NULL
          AND fx.employment_status = ANY($${i++})
      )`);
      params.push(filters.employmentStatuses);
    }

    return { clause: parts.join(' '), params };
  }

  private buildOrgDateWhere(
    orgId: string | null,
    filters: AnalyticsFilterDto,
    alias: string,
    dateCol: string,
  ) {
    const parts: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (orgId) {
      parts.push(`AND ${alias}.organization_id = $${i++}`);
      params.push(orgId);
    }
    if (filters.fromDate) {
      parts.push(`AND ${alias}.${dateCol} >= $${i++}::date`);
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      parts.push(`AND ${alias}.${dateCol} < ($${i++}::date + interval '1 day')`);
      params.push(filters.toDate);
    }
    if (filters.neighborhoodIds?.length) {
      parts.push(`AND EXISTS (
        SELECT 1 FROM "case".households hx
        WHERE hx.id = ${alias}.household_id AND hx.neighborhood_id = ANY($${i++})
      )`);
      params.push(filters.neighborhoodIds);
    }
    return { clause: parts.join(' '), params };
  }

  private toBuckets(
    rows: Array<{ band?: string; key?: string; count: number }>,
    catalog: Array<{ key: string; label: string }>,
  ): DistributionBucket[] {
    const map = new Map(rows.map((r) => [r.band ?? r.key ?? 'unknown', Number(r.count)]));
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    const keys = new Set([...catalog.map((c) => c.key), ...map.keys()]);
    const labelMap = new Map(catalog.map((c) => [c.key, c.label]));
    return Array.from(keys).map((key) => {
      const count = map.get(key) ?? 0;
      return {
        key,
        label: labelMap.get(key) ?? key,
        count,
        percent: Math.round((count / total) * 1000) / 10,
      };
    }).filter((b) => b.count > 0 || labelMap.has(b.key));
  }

  private async safeQuery(sql: string, params: unknown[]) {
    try {
      return await this.ds.query(sql, params);
    } catch {
      return [];
    }
  }
}
