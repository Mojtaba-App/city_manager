'use client';

import { useEffect, useState } from 'react';
import { NavIcon } from '@/components/NavIcons';
import { useFeedback } from '@/components/ui/Feedback';
import { upsertSetting, testMessagingConnection } from '@/lib/admin-api';
import { SMS_PROVIDER_OPTIONS, SMS_IR_DEFAULT_BASE, SETTINGS_REDACTED_PLACEHOLDER, isSettingsRedactedValue, smsProviderDefaultBase } from '@city-manager/shared';
import { SettingsAccordion } from './SettingsAccordion';

export type MessagingChannelConfig = {
  enabled?: boolean;
  provider?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  sender?: string;
  fromEmail?: string;
  fromName?: string;
  templates?: Array<{ code: string; name: string; body: string; externalId?: string }>;
};

type Channel = 'sms' | 'email';

const EMAIL_PROVIDERS = [
  { value: 'smtp', label: 'SMTP' },
  { value: 'sendgrid', label: 'SendGrid' },
  { value: 'custom', label: 'سرویس سفارشی (API)' },
];

const DEFAULT_TEMPLATES: Record<Channel, Array<{ code: string; name: string; body: string }>> = {
  sms: [
    { code: 'otp', name: 'کد تأیید', body: 'کد تأیید شما: {code}' },
    { code: 'notify', name: 'اطلاع‌رسانی', body: '{message}' },
  ],
  email: [
    { code: 'welcome', name: 'خوش‌آمد', body: 'سلام {name}، به سامانه خوش آمدید.' },
    { code: 'notify', name: 'اطلاع‌رسانی', body: '{message}' },
  ],
};

function emptyConfig(channel: Channel): MessagingChannelConfig {
  return {
    enabled: false,
    provider: channel === 'sms' ? 'smsir' : 'smtp',
    apiBaseUrl: channel === 'sms' ? SMS_IR_DEFAULT_BASE : '',
    apiKey: '',
    sender: '',
    fromEmail: '',
    fromName: '',
    templates: DEFAULT_TEMPLATES[channel].map((t) => ({ ...t })),
  };
}

function ChannelEditor({
  channel,
  title,
  description,
  initial,
  canWrite,
  onSaved,
}: {
  channel: Channel;
  title: string;
  description: string;
  initial?: MessagingChannelConfig | null;
  canWrite: boolean;
  onSaved?: () => void;
}) {
  const feedback = useFeedback();
  const [draft, setDraft] = useState<MessagingChannelConfig>(emptyConfig(channel));
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const base = emptyConfig(channel);
    setDraft({
      ...base,
      ...(initial ?? {}),
      templates: (initial?.templates?.length ? initial.templates : base.templates)?.map((t) => ({ ...t })),
      apiKey: initial?.apiKey && !isSettingsRedactedValue(initial.apiKey)
        ? SETTINGS_REDACTED_PLACEHOLDER
        : (initial?.apiKey ? SETTINGS_REDACTED_PLACEHOLDER : ''),
    });
    setApiKeyDirty(false);
    setTestMsg(null);
  }, [channel, initial]);

  function updateTemplate(idx: number, patch: Partial<{ code: string; name: string; body: string; externalId: string }>) {
    setDraft((prev) => {
      const templates = [...(prev.templates ?? [])];
      templates[idx] = { ...templates[idx], ...patch };
      return { ...prev, templates };
    });
  }

  function addTemplate() {
    setDraft((prev) => ({
      ...prev,
      templates: [...(prev.templates ?? []), { code: 'new', name: 'الگوی جدید', body: '' }],
    }));
  }

  function removeTemplate(idx: number) {
    setDraft((prev) => ({
      ...prev,
      templates: (prev.templates ?? []).filter((_, i) => i !== idx),
    }));
  }

  async function save() {
    setSaving(true);
    const value: MessagingChannelConfig = {
      enabled: Boolean(draft.enabled),
      provider: draft.provider,
      apiBaseUrl: draft.apiBaseUrl?.trim() || '',
      sender: draft.sender?.trim() || '',
      fromEmail: draft.fromEmail?.trim() || '',
      fromName: draft.fromName?.trim() || '',
      templates: (draft.templates ?? []).map((t) => ({
        code: t.code.trim(),
        name: t.name.trim(),
        body: t.body.trim(),
        ...(t.externalId?.trim() ? { externalId: t.externalId.trim() } : {}),
      })),
    };
    if (apiKeyDirty) {
      value.apiKey = draft.apiKey?.trim() || '';
    } else {
      // Keep stored secret when user did not edit the masked field
      value.apiKey = SETTINGS_REDACTED_PLACEHOLDER;
    }

    const key = channel === 'sms' ? 'messaging_sms' : 'messaging_email';
    const res = await upsertSetting({
      key,
      value: value as Record<string, unknown>,
      description: channel === 'sms' ? 'اتصال سامانه پیامکی' : 'اتصال سامانه ایمیلی',
    });
    setSaving(false);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'ذخیره ناموفق بود', title);
      return;
    }
    feedback.success('تنظیمات ذخیره شد', title);
    setApiKeyDirty(false);
    onSaved?.();
  }

  async function runTest() {
    setTesting(true);
    setTestMsg(null);
    const res = await testMessagingConnection(channel);
    setTesting(false);
    if (!res.success || !res.data) {
      setTestMsg({ ok: false, text: res.error?.message ?? 'تست انجام نشد' });
      feedback.error(res.error?.message ?? 'تست انجام نشد', title);
      return;
    }
    setTestMsg({ ok: res.data.ok, text: res.data.message });
    if (res.data.ok) feedback.success(res.data.message, 'تست اتصال');
    else feedback.error(res.data.message, 'تست اتصال');
  }

  return (
    <SettingsAccordion title={title} description={description} icon={channel === 'sms' ? 'activity' : 'integrations'} defaultOpen={false}>
      <div className="messaging-channel">
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={Boolean(draft.enabled)}
            disabled={!canWrite}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          />
          <span className="settings-toggle-ui" aria-hidden />
          <span className="settings-toggle-copy">
            <strong>فعال‌سازی {channel === 'sms' ? 'پیامک' : 'ایمیل'}</strong>
            <small>تا وقتی خاموش باشد، ارسال واقعی انجام نمی‌شود</small>
          </span>
        </label>

        <div className="settings-form-grid">
          <label className="settings-field">
            <span className="settings-field-label">سرویس‌دهنده</span>
            <select
              value={draft.provider ?? ''}
              disabled={!canWrite}
              onChange={(e) => {
                const provider = e.target.value;
                const prevDefault = smsProviderDefaultBase(draft.provider);
                const nextDefault = smsProviderDefaultBase(provider);
                const current = draft.apiBaseUrl?.trim() ?? '';
                const replaceUrl = !current || current === prevDefault;
                setDraft({
                  ...draft,
                  provider,
                  apiBaseUrl: channel === 'sms' && replaceUrl ? nextDefault : draft.apiBaseUrl,
                });
              }}
            >
              {(channel === 'sms' ? SMS_PROVIDER_OPTIONS : EMAIL_PROVIDERS).map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span className="settings-field-label">آدرس پایه API</span>
            <input
              dir="ltr"
              placeholder={channel === 'sms' ? 'https://api.sms.ir/v1' : 'https://api.sendgrid.com'}
              value={draft.apiBaseUrl ?? ''}
              disabled={!canWrite}
              onChange={(e) => setDraft({ ...draft, apiBaseUrl: e.target.value })}
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">کلید API</span>
            <input
              dir="ltr"
              type="password"
              placeholder={initial?.apiKey ? 'برای تغییر، کلید جدید وارد کنید' : 'API Key'}
              value={draft.apiKey ?? ''}
              disabled={!canWrite}
              onChange={(e) => {
                setApiKeyDirty(true);
                setDraft({ ...draft, apiKey: e.target.value });
              }}
            />
          </label>
          {channel === 'sms' ? (
            <label className="settings-field">
              <span className="settings-field-label">شماره/نام فرستنده</span>
              <input
                value={draft.sender ?? ''}
                disabled={!canWrite}
                onChange={(e) => setDraft({ ...draft, sender: e.target.value })}
                placeholder={draft.provider === 'smsir' ? 'شماره خط sms.ir مثلاً 3000xxxx' : 'مثلاً 1000xxx'}
              />
            </label>
          ) : (
            <>
              <label className="settings-field">
                <span className="settings-field-label">ایمیل فرستنده</span>
                <input
                  type="email"
                  dir="ltr"
                  value={draft.fromEmail ?? ''}
                  disabled={!canWrite}
                  onChange={(e) => setDraft({ ...draft, fromEmail: e.target.value })}
                />
              </label>
              <label className="settings-field">
                <span className="settings-field-label">نام نمایشی فرستنده</span>
                <input
                  value={draft.fromName ?? ''}
                  disabled={!canWrite}
                  onChange={(e) => setDraft({ ...draft, fromName: e.target.value })}
                />
              </label>
            </>
          )}
        </div>

        {channel === 'sms' && draft.provider === 'smsir' && (
          <p className="settings-field-hint messaging-provider-hint">
            کلید API را از پنل sms.ir (توسعه‌دهندگان) کپی کنید. فرستنده همان شماره خط (lineNumber) است.
            تست اتصال، موجودی حساب را از <span dir="ltr">GET /credit</span> می‌خواند.
          </p>
        )}

        <div className="messaging-templates">
          <div className="messaging-templates-head">
            <h4>الگوهای پیام</h4>
            {canWrite && (
              <button type="button" className="btn btn-sm" onClick={addTemplate}>
                افزودن الگو
              </button>
            )}
          </div>
          {(draft.templates ?? []).map((t, idx) => (
            <div key={`${t.code}-${idx}`} className={`messaging-template-row${channel === 'sms' && draft.provider === 'smsir' ? ' messaging-template-row--smsir' : ''}`}>
              <input
                placeholder="کد"
                value={t.code}
                disabled={!canWrite}
                onChange={(e) => updateTemplate(idx, { code: e.target.value })}
              />
              <input
                placeholder="عنوان"
                value={t.name}
                disabled={!canWrite}
                onChange={(e) => updateTemplate(idx, { name: e.target.value })}
              />
              <input
                placeholder="متن الگو — از {code} یا {name} استفاده کنید"
                value={t.body}
                disabled={!canWrite}
                onChange={(e) => updateTemplate(idx, { body: e.target.value })}
              />
              {channel === 'sms' && draft.provider === 'smsir' && (
                <input
                  dir="ltr"
                  placeholder="شناسه الگوی sms.ir (اختیاری)"
                  value={t.externalId ?? ''}
                  disabled={!canWrite}
                  onChange={(e) => updateTemplate(idx, { externalId: e.target.value })}
                />
              )}
              {canWrite && (
                <button type="button" className="btn btn-sm" onClick={() => removeTemplate(idx)}>
                  حذف
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="messaging-actions">
          {canWrite && (
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}
            </button>
          )}
          <button type="button" className="btn" disabled={testing} onClick={() => void runTest()}>
            <NavIcon name="activity" size={16} />
            {testing ? 'در حال تست…' : 'تست اتصال'}
          </button>
        </div>

        {testMsg && (
          <div className={`messaging-test-result ${testMsg.ok ? 'ok' : 'fail'}`}>
            <strong>{testMsg.ok ? 'اتصال قابل قبول است' : 'اتصال کامل نیست'}</strong>
            <span>{testMsg.text}</span>
          </div>
        )}
      </div>
    </SettingsAccordion>
  );
}

export function MessagingSettings({
  sms,
  email,
  canWrite,
  onSaved,
}: {
  sms?: MessagingChannelConfig | null;
  email?: MessagingChannelConfig | null;
  canWrite: boolean;
  onSaved?: () => void;
}) {
  return (
    <div className="messaging-settings">
      <ChannelEditor
        channel="sms"
        title="سامانه پیامکی"
        description="کلید API، فرستنده و الگوهای پیامک — پشتیبانی از sms.ir، کاوه‌نگار و ملی‌پیامک"
        initial={sms}
        canWrite={canWrite}
        onSaved={onSaved}
      />
      <ChannelEditor
        channel="email"
        title="سامانه ایمیلی"
        description="کلید API / SMTP، فرستنده و الگوهای ایمیل"
        initial={email}
        canWrite={canWrite}
        onSaved={onSaved}
      />
    </div>
  );
}
