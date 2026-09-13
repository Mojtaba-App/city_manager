import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { SystemSetting } from '../entities/system-setting.entity';
import { UpsertSettingDto } from '../dto/admin.dto';
import { AdminDashboardStats, DEFAULT_REPORTS, SMS_IR_DEFAULT_BASE, buildSmsConnectionProbe, isSmsIrProvider, mergeSettingsValuePreservingSecrets, parseSmsIrApiResult, redactSettingsValue } from '@city-manager/shared';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(SystemSetting) private readonly settingsRepo: Repository<SystemSetting>,
  ) {}

  async getStats(orgId: string | null): Promise<{ success: true; data: AdminDashboardStats }> {
    const params = orgId ? [orgId] : [];
    const orgCase = orgId ? 'AND organization_id = $1' : '';
    const orgProgram = orgId ? 'AND organization_id = $1' : '';
    const orgGis = orgId ? 'AND organization_id = $1' : '';
    const orgAudit = orgId ? 'AND organization_id = $1' : '';

    try {
      const rows = await this.dataSource.query(
        `
        SELECT
          (SELECT COUNT(*)::int FROM core.users WHERE deleted_at IS NULL ${orgCase}) AS users_total,
          (SELECT COUNT(*)::int FROM core.users WHERE deleted_at IS NULL AND is_active = true ${orgCase}) AS users_active,
          (SELECT COUNT(*)::int FROM "case".households WHERE deleted_at IS NULL ${orgCase}) AS households_total,
          (SELECT COUNT(*)::int FROM "case".households WHERE deleted_at IS NULL AND status = 'active' ${orgCase}) AS households_active,
          (SELECT COUNT(*)::int FROM "case".dwellings WHERE deleted_at IS NULL ${orgCase}) AS dwellings_total,
          (SELECT COUNT(*)::int FROM program.neighborhoods WHERE deleted_at IS NULL ${orgProgram}) AS neighborhoods_total,
          (SELECT COUNT(*)::int FROM gis.fabrics WHERE deleted_at IS NULL ${orgGis}) AS fabrics_total,
          (SELECT COUNT(*)::int FROM trajectory.life_trajectory_records WHERE deleted_at IS NULL ${orgCase}) AS trajectory_events_total,
          (SELECT COUNT(*)::int FROM audit.audit_logs WHERE true ${orgAudit}) AS recent_activity_count
        `,
        params,
      );
      const row = rows[0] ?? {};
      return {
        success: true,
        data: {
          usersTotal: Number(row.users_total ?? 0),
          usersActive: Number(row.users_active ?? 0),
          householdsTotal: Number(row.households_total ?? 0),
          householdsActive: Number(row.households_active ?? 0),
          dwellingsTotal: Number(row.dwellings_total ?? 0),
          neighborhoodsTotal: Number(row.neighborhoods_total ?? 0),
          fabricsTotal: Number(row.fabrics_total ?? 0),
          trajectoryEventsTotal: Number(row.trajectory_events_total ?? 0),
          recentActivityCount: Number(row.recent_activity_count ?? 0),
        },
      };
    } catch {
      /* Fallback when some schemas are missing */
      const usersTotal = await this.safeCount(
        `SELECT COUNT(*)::int AS count FROM core.users WHERE deleted_at IS NULL ${orgCase}`,
        params,
      );
      const usersActive = await this.safeCount(
        `SELECT COUNT(*)::int AS count FROM core.users WHERE deleted_at IS NULL AND is_active = true ${orgCase}`,
        params,
      );
      return {
        success: true,
        data: {
          usersTotal,
          usersActive,
          householdsTotal: 0,
          householdsActive: 0,
          dwellingsTotal: 0,
          neighborhoodsTotal: 0,
          fabricsTotal: 0,
          trajectoryEventsTotal: 0,
          recentActivityCount: await this.auditRepo.count(orgId ? { where: { organizationId: orgId } } : {}),
        },
      };
    }
  }

  private async safeCount(sql: string, params: unknown[]): Promise<number> {
    try {
      const rows = await this.dataSource.query(sql, params);
      return Number(rows[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }

  async getRecentActivity(orgId: string | null, limit = 20) {
    const qb = this.auditRepo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC').take(limit);
    if (orgId) qb.where('a.organization_id = :orgId', { orgId });
    const data = await qb.getMany();
    return { success: true, data };
  }

  async listSettings(orgId: string) {
    const data = await this.settingsRepo.find({
      where: { organizationId: orgId },
      order: { key: 'ASC' },
    });
    const defaults = this.defaultSettings(orgId);
    const map = new Map(data.map((s) => [s.key, s]));
    for (const d of defaults) {
      if (!map.has(d.key)) map.set(d.key, d as unknown as SystemSetting);
    }
    const redacted = Array.from(map.values()).map((row) => ({
      ...row,
      value: redactSettingsValue((row.value ?? {}) as Record<string, unknown>),
    }));
    return { success: true, data: redacted };
  }

  /** Public branding for login page / favicon (no auth). */
  async getPublicBranding() {
    const defaults = {
      logoUrl: '',
      markText: 'CM',
      title: '',
      subtitle: 'پنل مدیریت',
      loginTitle: '',
      loginSubtitle: 'ورود به پنل مدیریت',
      loginHeroTagline: 'سامانه مدیر شهر؛ زیرساخت هوشمند بازآفرینی شهری',
      loginIconUrl: '',
      faviconUrl: '',
      loginBackgroundUrl: '/images/login-bg.jpg',
    };
    const rows = await this.settingsRepo.find({
      where: { key: 'org_branding' },
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    const value = (rows[0]?.value ?? {}) as Record<string, unknown>;
    return {
      success: true as const,
      data: {
        ...defaults,
        ...value,
        loginBackgroundUrl:
          (typeof value.loginBackgroundUrl === 'string' && value.loginBackgroundUrl)
          || defaults.loginBackgroundUrl,
      },
    };
  }

  /** Lightweight UI config for any authenticated user (sidebar labels/icons + map defaults). */
  async getUiConfig(orgId: string | null) {
    const ahvaz = { center: [48.669, 31.3203], zoom: 12, basemap: 'osm' };
    const emptyBrand = {
      logoUrl: '',
      markText: 'CM',
      title: '',
      subtitle: 'پنل مدیریت',
      loginTitle: '',
      loginSubtitle: 'ورود به پنل مدیریت',
      loginHeroTagline: 'سامانه مدیر شهر؛ زیرساخت هوشمند بازآفرینی شهری',
      loginIconUrl: '',
      faviconUrl: '',
      loginBackgroundUrl: '/images/login-bg.jpg',
    };
    if (!orgId) {
      return {
        success: true as const,
        data: {
          sidebar_nav: { items: {} },
          map_defaults: ahvaz,
          org_branding: emptyBrand,
        },
      };
    }
    const rows = await this.settingsRepo.find({
      where: [
        { organizationId: orgId, key: 'sidebar_nav' },
        { organizationId: orgId, key: 'map_defaults' },
        { organizationId: orgId, key: 'org_branding' },
      ],
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return {
      success: true as const,
      data: {
        sidebar_nav: (byKey.get('sidebar_nav') as Record<string, unknown>) ?? { items: {} },
        map_defaults: (byKey.get('map_defaults') as Record<string, unknown>) ?? ahvaz,
        org_branding: (byKey.get('org_branding') as Record<string, unknown>) ?? emptyBrand,
      },
    };
  }

  async upsertSetting(orgId: string, userId: string, dto: UpsertSettingDto) {
    let row = await this.settingsRepo.findOne({ where: { organizationId: orgId, key: dto.key } });
    const mergedValue = mergeSettingsValuePreservingSecrets(
      (row?.value ?? undefined) as Record<string, unknown> | undefined,
      dto.value ?? {},
    );
    if (!row) {
      row = this.settingsRepo.create({
        organizationId: orgId,
        key: dto.key,
        value: mergedValue,
        description: dto.description,
        updatedBy: userId,
      });
    } else {
      row.value = mergedValue;
      if (dto.description != null) row.description = dto.description;
      row.updatedBy = userId;
    }
    const saved = await this.settingsRepo.save(row);
    return {
      success: true,
      data: {
        ...saved,
        value: redactSettingsValue((saved.value ?? {}) as Record<string, unknown>),
      },
    };
  }

  async testDatabaseConnection() {
    const started = Date.now();
    try {
      await this.dataSource.query('SELECT 1 AS ok');
      const latencyMs = Date.now() - started;
      const driver = this.dataSource.options.type ?? 'postgres';
      const dbName =
        typeof this.dataSource.options.database === 'string'
          ? this.dataSource.options.database
          : undefined;
      return {
        success: true as const,
        data: {
          ok: true,
          latencyMs,
          driver,
          database: dbName,
          checkedAt: new Date().toISOString(),
          message: 'اتصال به پایگاه داده برقرار است',
        },
      };
    } catch (err) {
      const latencyMs = Date.now() - started;
      const message = err instanceof Error ? err.message : 'خطای ناشناخته';
      return {
        success: true as const,
        data: {
          ok: false,
          latencyMs,
          checkedAt: new Date().toISOString(),
          message: `اتصال ناموفق: ${message}`,
        },
      };
    }
  }

  async testMessagingConnection(orgId: string, channel: 'sms' | 'email') {
    const key = channel === 'sms' ? 'messaging_sms' : 'messaging_email';
    const label = channel === 'sms' ? 'پیامک' : 'ایمیل';
    const row = await this.settingsRepo.findOne({ where: { organizationId: orgId, key } });
    const cfg = (row?.value ?? {}) as Record<string, unknown>;
    const checkedAt = new Date().toISOString();

    if (!cfg.enabled) {
      return {
        success: true as const,
        data: {
          ok: false,
          channel,
          checkedAt,
          message: `سامانه ${label} هنوز فعال نشده است. ابتدا گزینه فعال‌سازی را روشن و تنظیمات را ذخیره کنید.`,
        },
      };
    }

    const apiKey = typeof cfg.apiKey === 'string' ? cfg.apiKey.trim() : '';
    const provider = typeof cfg.provider === 'string' ? cfg.provider.trim() : '';
    if (!apiKey) {
      return {
        success: true as const,
        data: {
          ok: false,
          channel,
          checkedAt,
          message: `کلید API برای ${label} ثبت نشده است. کلید را وارد و ذخیره کنید، سپس دوباره تست کنید.`,
        },
      };
    }

    if (channel === 'sms') {
      const sender = typeof cfg.sender === 'string' ? cfg.sender.trim() : '';
      if (!sender) {
        return {
          success: true as const,
          data: {
            ok: false,
            channel,
            checkedAt,
            message: 'شماره یا نام فرستنده پیامک خالی است. این مقدار برای ارسال پیامک لازم است.',
          },
        };
      }
    } else {
      const fromEmail = typeof cfg.fromEmail === 'string' ? cfg.fromEmail.trim() : '';
      if (!fromEmail || !fromEmail.includes('@')) {
        return {
          success: true as const,
          data: {
            ok: false,
            channel,
            checkedAt,
            message: 'ایمیل فرستنده معتبر نیست. یک آدرس ایمیل درست وارد و ذخیره کنید.',
          },
        };
      }
    }

    const templates = Array.isArray(cfg.templates) ? cfg.templates : [];
    if (templates.length === 0) {
      return {
        success: true as const,
        data: {
          ok: false,
          channel,
          checkedAt,
          message: `هیچ الگوی پیامی برای ${label} تعریف نشده است. حداقل یک الگو اضافه کنید.`,
        },
      };
    }

    let apiBaseUrl = typeof cfg.apiBaseUrl === 'string' ? cfg.apiBaseUrl.trim() : '';
    if (channel === 'sms' && isSmsIrProvider(provider, apiBaseUrl) && !apiBaseUrl) {
      apiBaseUrl = SMS_IR_DEFAULT_BASE;
    }
    if (!apiBaseUrl) {
      return {
        success: true as const,
        data: {
          ok: true,
          channel,
          checkedAt,
          message: `تنظیمات ${label} کامل به‌نظر می‌رسد. آدرس API خالی است؛ وقتی سرویس‌دهنده مشخص شد می‌توانید آدرس را هم اضافه کنید.`,
        },
      };
    }

    const probe = channel === 'sms'
      ? buildSmsConnectionProbe({ provider, apiBaseUrl, apiKey })
      : { url: apiBaseUrl, method: 'GET' as const, headers: { Accept: 'application/json' } };

    let parsed: URL;
    try {
      parsed = new URL(probe.url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('bad protocol');
      }
    } catch {
      return {
        success: true as const,
        data: {
          ok: false,
          channel,
          checkedAt,
          message: 'آدرس پایه API معتبر نیست. آدرس باید با http یا https شروع شود.',
        },
      };
    }

    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(parsed.toString(), {
        method: probe.method,
        signal: controller.signal,
        headers: probe.headers,
      });
      clearTimeout(timer);
      const latencyMs = Date.now() - started;
      if (channel === 'sms' && isSmsIrProvider(provider, apiBaseUrl)) {
        let json: unknown = {};
        try {
          json = await res.json();
        } catch {
          json = {};
        }
        const parsedSms = parseSmsIrApiResult(json, res.ok);
        return {
          success: true as const,
          data: {
            ok: parsedSms.ok,
            channel,
            latencyMs,
            checkedAt,
            message: parsedSms.ok
              ? `${parsedSms.message} (${latencyMs} میلی‌ثانیه)`
              : parsedSms.message,
          },
        };
      }
      if (res.status >= 500) {
        return {
          success: true as const,
          data: {
            ok: false,
            channel,
            latencyMs,
            checkedAt,
            message: `سرویس ${label} پاسخ خطای داخلی داد (کد ${res.status}). آدرس یا وضعیت سرویس‌دهنده را بررسی کنید.`,
          },
        };
      }
      return {
        success: true as const,
        data: {
          ok: true,
          channel,
          latencyMs,
          checkedAt,
          message: `اتصال به آدرس API برقرار شد (پاسخ در ${latencyMs} میلی‌ثانیه). ارسال واقعی پیام هنوز فعال نشده و فقط صحت تنظیمات بررسی شد.`,
        },
      };
    } catch (err) {
      const latencyMs = Date.now() - started;
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        success: true as const,
        data: {
          ok: false,
          channel,
          latencyMs,
          checkedAt,
          message: aborted
            ? `پاسخی از سرویس ${label} در زمان معقول نرسید. آدرس API یا دسترسی شبکه سرور را بررسی کنید.`
            : `دسترسی به آدرس API ${label} ممکن نشد. آدرس را بررسی کنید یا بعداً دوباره تست کنید.`,
        },
      };
    }
  }

  listReports() {
    return { success: true, data: DEFAULT_REPORTS };
  }

  async householdStatusBreakdown(orgId: string | null) {
    try {
      const params = orgId ? [orgId] : [];
      const sql = orgId
        ? `SELECT status, COUNT(*)::int AS count FROM "case".households WHERE deleted_at IS NULL AND organization_id = $1 GROUP BY status`
        : `SELECT status, COUNT(*)::int AS count FROM "case".households WHERE deleted_at IS NULL GROUP BY status`;
      const rows = await this.dataSource.query(sql, params);
      return { success: true, data: rows };
    } catch {
      return { success: true, data: [] };
    }
  }

  private defaultSettings(orgId: string) {
    return [
      {
        id: 'default-locale',
        organizationId: orgId,
        key: 'locale',
        value: { language: 'fa', calendar: 'jalali', timezone: 'Asia/Tehran' },
        description: 'زبان، تقویم و منطقه زمانی نمایش',
      },
      {
        id: 'default-pii',
        organizationId: orgId,
        key: 'pii_policy',
        value: { maskNationalId: true, requireReasonForExport: true },
        description: 'حفاظت از اطلاعات شخصی حساس',
      },
      {
        id: 'default-map',
        organizationId: orgId,
        key: 'map_defaults',
        value: { center: [48.669, 31.3203], zoom: 12, basemap: 'osm' },
        description: 'شهر و نقشه پایه پیش‌فرض',
      },
      {
        id: 'default-case',
        organizationId: orgId,
        key: 'case_defaults',
        value: { defaultStatus: 'draft', requireCaseNumber: true },
        description: 'پیش‌فرض هنگام ثبت پرونده خانوار',
      },
      {
        id: 'default-sidebar',
        organizationId: orgId,
        key: 'sidebar_nav',
        value: { items: {} },
        description: 'برچسب و آیکن آیتم‌های سایدبار',
      },
      {
        id: 'default-branding',
        organizationId: orgId,
        key: 'org_branding',
        value: {
          logoUrl: '',
          markText: 'CM',
          title: '',
          subtitle: 'پنل مدیریت',
          loginTitle: '',
          loginSubtitle: 'ورود به پنل مدیریت',
          loginHeroTagline: 'سامانه مدیر شهر؛ زیرساخت هوشمند بازآفرینی شهری',
          loginIconUrl: '',
          faviconUrl: '',
          loginBackgroundUrl: '/images/login-bg.jpg',
        },
        description: 'لوگو، عنوان، صفحه ورود، پس‌زمینه و favicon مرورگر',
      },
      {
        id: 'default-password-policy',
        organizationId: orgId,
        key: 'password_policy',
        value: { minLength: 8, requireUpper: false, requireSymbol: false, captchaAfterLock: true },
        description: 'سیاست رمز عبور سازمانی و کپچا پس از قفل ورود',
      },
      {
        id: 'default-messaging-sms',
        organizationId: orgId,
        key: 'messaging_sms',
        value: {
          enabled: false,
          provider: 'smsir',
          apiBaseUrl: 'https://api.sms.ir/v1',
          apiKey: '',
          sender: '',
          templates: [
            { code: 'otp', name: 'کد تأیید', body: 'کد تأیید شما: {code}' },
            { code: 'notify', name: 'اطلاع‌رسانی', body: '{message}' },
          ],
        },
        description: 'اتصال سامانه پیامکی',
      },
      {
        id: 'default-messaging-email',
        organizationId: orgId,
        key: 'messaging_email',
        value: {
          enabled: false,
          provider: 'smtp',
          apiBaseUrl: '',
          apiKey: '',
          fromEmail: '',
          fromName: '',
          templates: [
            { code: 'welcome', name: 'خوش‌آمد', body: 'سلام {name}، به سامانه خوش آمدید.' },
            { code: 'notify', name: 'اطلاع‌رسانی', body: '{message}' },
          ],
        },
        description: 'اتصال سامانه ایمیلی',
      },
    ];
  }
}
