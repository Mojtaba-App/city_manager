'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader, PermissionGate } from '@/components/admin/AdminUi';
import { SidebarNavSettings } from '@/components/settings/SidebarNavSettings';
import { BrandingSettings, OrgBranding } from '@/components/settings/BrandingSettings';
import { OrgFriendlySettings } from '@/components/settings/OrgFriendlySettings';
import { DatabaseTestCard } from '@/components/settings/DatabaseTestCard';
import { MessagingSettings, MessagingChannelConfig } from '@/components/settings/MessagingSettings';
import { AdvancedJsonSettingsEditor } from '@/components/settings/AdvancedJsonSettingsEditor';
import { SettingsAccordion } from '@/components/settings/SettingsAccordion';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { fetchSettings } from '@/lib/admin-api';
import { SidebarNavSetting } from '@/lib/nav-config';
import { NavIcon } from '@/components/NavIcons';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

type SettingRow = {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description?: string;
};

const FRIENDLY_KEYS = new Set([
  'locale',
  'pii_policy',
  'map_defaults',
  'case_defaults',
  'sidebar_nav',
  'org_branding',
  'messaging_sms',
  'messaging_email',
  'password_policy',
]);

export default function SettingsPage() {
  const { hasPermission, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const isSuperAdmin = Boolean(profile?.roles.includes('super_admin'));
  const canRead = hasPermission('settings:read') || isSuperAdmin;
  const canWrite = hasPermission('settings:write') || isSuperAdmin;
  const { loading, error, setError, run } = useQueryLoad();

  async function load() {
    await run(async () => {
      const res = await fetchSettings();
      if (res.success && res.data) setSettings(res.data as SettingRow[]);
      else if (!res.success) setError(res.error?.message ?? 'بارگذاری تنظیمات ناموفق بود');
    });
  }

  useEffect(() => {
    if (canRead) void load();
  }, [canRead]);

  const valueMap = useMemo(() => {
    const map: Record<string, Record<string, unknown>> = {};
    for (const s of settings) map[s.key] = s.value ?? {};
    return map;
  }, [settings]);

  const sidebarSetting = settings.find((s) => s.key === 'sidebar_nav');
  const brandingSetting = settings.find((s) => s.key === 'org_branding');
  const smsSetting = settings.find((s) => s.key === 'messaging_sms');
  const emailSetting = settings.find((s) => s.key === 'messaging_email');
  const extraSettings = settings.filter((s) => !FRIENDLY_KEYS.has(s.key));

  return (
    <AppShell title="تنظیمات سیستم">
      <PermissionGate allow={canRead}>
        <PageHeader
          title="تنظیمات سازمان"
          description="بخش‌ها را باز کنید؛ برند، منو، پیامک/ایمیل، زبان، حریم خصوصی و اتصال پایگاه داده"
        />

        <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={6} />} loadingLabel="در حال بارگذاری تنظیمات…">
        <div className="settings-stack">
          <DatabaseTestCard canRun={canRead} />

          <SettingsAccordion
            title="ظاهر پنل"
            description="حالت روشن یا تاریک فقط برای همین دستگاه ذخیره می‌شود"
            icon={theme === 'dark' ? 'moon' : 'sun'}
          >
            <div className="theme-settings-actions">
              <button
                type="button"
                className={`btn theme-choice ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <NavIcon name="sun" size={18} />
                روشن
              </button>
              <button
                type="button"
                className={`btn theme-choice ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <NavIcon name="moon" size={18} />
                تاریک
              </button>
            </div>
          </SettingsAccordion>

          <BrandingSettings
            initial={(brandingSetting?.value as OrgBranding) ?? null}
            canWrite={canWrite}
            onSaved={load}
          />

          <SidebarNavSettings
            initial={(sidebarSetting?.value as SidebarNavSetting) ?? null}
            canWrite={canWrite}
            onSaved={load}
          />

          <MessagingSettings
            sms={(smsSetting?.value as MessagingChannelConfig) ?? null}
            email={(emailSetting?.value as MessagingChannelConfig) ?? null}
            canWrite={canWrite}
            onSaved={load}
          />

          <OrgFriendlySettings values={valueMap} canWrite={canWrite} onSaved={load} />

          <SettingsAccordion
            title="سایر تنظیمات"
            description="ویرایشگر JSON برای کلیدهای پیشرفته سازمان"
            icon="settings"
          >
            <AdvancedJsonSettingsEditor
              items={extraSettings}
              canWrite={canWrite}
              onSaved={load}
            />
          </SettingsAccordion>
        </div>
        </QueryState>
      </PermissionGate>
    </AppShell>
  );
}
