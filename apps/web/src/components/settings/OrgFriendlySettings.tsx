'use client';

import { useEffect, useState } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { upsertSetting } from '@/lib/admin-api';
import { SettingsAccordion } from './SettingsAccordion';

type SettingMap = Record<string, Record<string, unknown>>;

const CITY_PRESETS: Array<{ id: string; label: string; center: [number, number] }> = [
  { id: 'ahvaz', label: 'اهواز', center: [48.669, 31.3203] },
  { id: 'tehran', label: 'تهران', center: [51.389, 35.6892] },
  { id: 'isfahan', label: 'اصفهان', center: [51.6746, 32.6539] },
  { id: 'shiraz', label: 'شیراز', center: [52.5311, 29.5918] },
  { id: 'mashhad', label: 'مشهد', center: [59.6168, 36.2605] },
];

const BASEMAP_OPTIONS = [
  { value: 'osm', label: 'نقشه خیابانی (OpenStreetMap)' },
  { value: 'googleSatellite', label: 'تصویر ماهواره‌ای گوگل' },
  { value: 'googleHybrid', label: 'ترکیبی گوگل (ماهواره + برچسب)' },
  { value: 'googleTerrain', label: 'پستی‌بلندی گوگل' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'active', label: 'فعال' },
  { value: 'suspended', label: 'معلق' },
  { value: 'graduated', label: 'فارغ‌شده' },
  { value: 'withdrawn', label: 'انصراف' },
  { value: 'archived', label: 'بایگانی' },
];

function matchCity(center: unknown): string {
  if (!Array.isArray(center) || center.length < 2) return 'ahvaz';
  const [lng, lat] = center.map(Number);
  let best = 'ahvaz';
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of CITY_PRESETS) {
    const d = Math.hypot(c.center[0] - lng, c.center[1] - lat);
    if (d < bestDist) {
      bestDist = d;
      best = c.id;
    }
  }
  return bestDist < 0.35 ? best : 'ahvaz';
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label className={`settings-toggle ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="settings-toggle-ui" aria-hidden />
      <span className="settings-toggle-copy">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-field settings-field--inline">
      <span className="settings-field-label">{label}</span>
      {children}
      <span className={`settings-field-hint${hint ? '' : ' is-placeholder'}`}>{hint ?? '\u00A0'}</span>
    </div>
  );
}

export function OrgFriendlySettings({
  values,
  canWrite,
  onSaved,
}: {
  values: SettingMap;
  canWrite: boolean;
  onSaved?: () => void;
}) {
  const feedback = useFeedback();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const locale = values.locale ?? { language: 'fa', calendar: 'jalali', timezone: 'Asia/Tehran' };
  const pii = values.pii_policy ?? { maskNationalId: true, requireReasonForExport: true };
  const map = values.map_defaults ?? { center: [48.669, 31.3203], zoom: 12, basemap: 'osm' };
  const cases = values.case_defaults ?? { defaultStatus: 'draft', requireCaseNumber: true };

  const [localeDraft, setLocaleDraft] = useState(locale);
  const [piiDraft, setPiiDraft] = useState(pii);
  const [mapDraft, setMapDraft] = useState({
    city: matchCity(map.center),
    zoom: Number(map.zoom ?? 12),
    basemap: String(map.basemap ?? 'osm'),
  });
  const [caseDraft, setCaseDraft] = useState(cases);

  useEffect(() => {
    setLocaleDraft(locale);
    setPiiDraft(pii);
    setMapDraft({
      city: matchCity(map.center),
      zoom: Number(map.zoom ?? 12),
      basemap: String(map.basemap ?? 'osm'),
    });
    setCaseDraft(cases);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  async function save(key: string, value: Record<string, unknown>, description: string) {
    setSavingKey(key);
    const res = await upsertSetting({ key, value, description });
    setSavingKey(null);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'ذخیره ناموفق بود', 'خطا');
      return;
    }
    feedback.success('تنظیمات ذخیره شد');
    onSaved?.();
  }

  return (
    <div className="org-settings-friendly">
      <SettingsAccordion
        title="زبان و زمان"
        description="چگونه تاریخ، ساعت و متن‌ها در پنل نمایش داده شوند"
        icon="settings"
      >
        <div className="settings-form-grid">
          <Field label="زبان پنل" hint="فعلاً فارسی پیشنهاد می‌شود">
            <select
              value={String(localeDraft.language ?? 'fa')}
              disabled={!canWrite}
              onChange={(e) => setLocaleDraft({ ...localeDraft, language: e.target.value })}
            >
              <option value="fa">فارسی</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="نوع تقویم" hint="برای نمایش تاریخ در گزارش‌ها و فرم‌ها">
            <select
              value={String(localeDraft.calendar ?? 'jalali')}
              disabled={!canWrite}
              onChange={(e) => setLocaleDraft({ ...localeDraft, calendar: e.target.value })}
            >
              <option value="jalali">شمسی (جلالی)</option>
              <option value="gregorian">میلادی</option>
            </select>
          </Field>
          <Field label="منطقه زمانی">
            <select
              value={String(localeDraft.timezone ?? 'Asia/Tehran')}
              disabled={!canWrite}
              onChange={(e) => setLocaleDraft({ ...localeDraft, timezone: e.target.value })}
            >
              <option value="Asia/Tehran">تهران (ایران)</option>
              <option value="Asia/Dubai">دبی</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
        </div>
        {canWrite && (
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingKey === 'locale'}
              onClick={() =>
                void save('locale', localeDraft as Record<string, unknown>, 'زبان، تقویم و منطقه زمانی نمایش')
              }
            >
              {savingKey === 'locale' ? 'در حال ذخیره…' : 'ذخیره زبان و زمان'}
            </button>
          </div>
        )}
      </SettingsAccordion>

      <SettingsAccordion
        title="حریم خصوصی اطلاعات"
        description="چطور با کد ملی و خروجی گرفتن از داده‌های حساس برخورد شود"
        icon="security"
      >
        <div className="settings-toggle-list">
          <Toggle
            checked={Boolean(piiDraft.maskNationalId)}
            disabled={!canWrite}
            onChange={(v) => setPiiDraft({ ...piiDraft, maskNationalId: v })}
            label="مخفی کردن بخشی از کد ملی"
            hint="در لیست‌ها و گزارش‌ها کد ملی کامل دیده نشود"
          />
          <Toggle
            checked={Boolean(piiDraft.requireReasonForExport)}
            disabled={!canWrite}
            onChange={(v) => setPiiDraft({ ...piiDraft, requireReasonForExport: v })}
            label="الزام ثبت دلیل هنگام خروجی گرفتن"
            hint="کاربر باید علت دریافت فایل خروجی را بنویسد"
          />
        </div>
        {canWrite && (
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingKey === 'pii_policy'}
              onClick={() =>
                void save(
                  'pii_policy',
                  piiDraft as Record<string, unknown>,
                  'حفاظت از اطلاعات شخصی حساس',
                )
              }
            >
              {savingKey === 'pii_policy' ? 'در حال ذخیره…' : 'ذخیره حریم خصوصی'}
            </button>
          </div>
        )}
      </SettingsAccordion>

      <SettingsAccordion
        title="نقشه پیش‌فرض"
        description="وقتی نقشه باز می‌شود از کدام شهر و با چه پس‌زمینه‌ای شروع شود"
        icon="map"
      >
        <div className="settings-form-grid">
          <Field label="شهر مرکز نقشه">
            <select
              value={mapDraft.city}
              disabled={!canWrite}
              onChange={(e) => setMapDraft({ ...mapDraft, city: e.target.value })}
            >
              {CITY_PRESETS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="میزان بزرگ‌نمایی اولیه" hint="عدد بالاتر = نزدیک‌تر">
            <select
              value={String(mapDraft.zoom)}
              disabled={!canWrite}
              onChange={(e) => setMapDraft({ ...mapDraft, zoom: Number(e.target.value) })}
            >
              {[10, 11, 12, 13, 14, 15].map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </Field>
          <Field label="نوع نقشه پایه">
            <select
              value={mapDraft.basemap}
              disabled={!canWrite}
              onChange={(e) => setMapDraft({ ...mapDraft, basemap: e.target.value })}
            >
              {BASEMAP_OPTIONS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {canWrite && (
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingKey === 'map_defaults'}
              onClick={() => {
                const city = CITY_PRESETS.find((c) => c.id === mapDraft.city) ?? CITY_PRESETS[0];
                void save(
                  'map_defaults',
                  {
                    center: city.center,
                    zoom: mapDraft.zoom,
                    basemap: mapDraft.basemap,
                  },
                  'شهر و نقشه پایه پیش‌فرض',
                );
              }}
            >
              {savingKey === 'map_defaults' ? 'در حال ذخیره…' : 'ذخیره نقشه'}
            </button>
          </div>
        )}
      </SettingsAccordion>

      <SettingsAccordion
        title="پیش‌فرض پرونده خانوار"
        description="وضعیت اولیه پرونده‌های جدید و الزام شماره پرونده"
        icon="households"
      >
        <div className="settings-form-grid">
          <Field label="وضعیت اولیه پرونده جدید">
            <select
              value={String(caseDraft.defaultStatus ?? 'draft')}
              disabled={!canWrite}
              onChange={(e) => setCaseDraft({ ...caseDraft, defaultStatus: e.target.value })}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="settings-toggle-list">
          <Toggle
            checked={Boolean(caseDraft.requireCaseNumber)}
            disabled={!canWrite}
            onChange={(v) => setCaseDraft({ ...caseDraft, requireCaseNumber: v })}
            label="شماره پرونده اجباری باشد"
            hint="بدون وارد کردن شماره پرونده، ثبت کامل نشود"
          />
        </div>
        {canWrite && (
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingKey === 'case_defaults'}
              onClick={() =>
                void save(
                  'case_defaults',
                  caseDraft as Record<string, unknown>,
                  'پیش‌فرض هنگام ثبت پرونده خانوار',
                )
              }
            >
              {savingKey === 'case_defaults' ? 'در حال ذخیره…' : 'ذخیره پیش‌فرض پرونده'}
            </button>
          </div>
        )}
      </SettingsAccordion>
    </div>
  );
}
