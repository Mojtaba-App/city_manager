'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader, PermissionGate, EmptyState } from '@/components/admin/AdminUi';
import { NavIcon } from '@/components/NavIcons';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/components/ui/Feedback';
import {
  fetchSecurityOverview,
  fetchAbacPolicies,
  createAbacPolicy,
  updateAbacPolicy,
  deleteAbacPolicy,
  fetchSecrets,
  upsertSecret,
  deleteSecret,
  fetchOauthClients,
  createOauthClient,
  revokeOauthClient,
  evaluateAbac,
  previewMasking,
} from '@/lib/security-api';
import { formatDateTime, formatNumber } from '@/lib/format';
import {
  firstQueryFailure,
  SECURITY_FIELDS,
  type SecurityOverviewDto,
  type SecretMetaDto,
  type OauthClientDto,
} from '@city-manager/shared';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

type Tab = 'overview' | 'policies' | 'secrets' | 'oauth' | 'tools';

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: 'overview', label: 'نمای کلی', hint: 'وضعیت امنیتی سامانه در یک نگاه' },
  { id: 'policies', label: 'قوانین دسترسی', hint: 'چه کسی به چه داده‌ای دسترسی دارد' },
  { id: 'secrets', label: 'کلیدهای محرمانه', hint: 'رمزها و کلیدهای سرویس‌ها' },
  { id: 'oauth', label: 'اتصال سامانه‌ها', hint: 'اجازه دسترسی سامانه‌های بیرونی' },
  { id: 'tools', label: 'آزمایش‌ها', hint: 'بررسی سریع دسترسی و مخفی‌سازی داده' },
];

const EFFECT_LABEL: Record<string, string> = {
  allow: 'مجاز',
  deny: 'غیرمجاز',
  permit: 'مجاز',
};

export default function SecurityPage() {
  const { hasPermission } = useAuth();
  const feedback = useFeedback();
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<SecurityOverviewDto | null>(null);
  const [policies, setPolicies] = useState<Array<Record<string, unknown>>>([]);
  const [secrets, setSecrets] = useState<SecretMetaDto[]>([]);
  const [clients, setClients] = useState<OauthClientDto[]>([]);
  const [secretForm, setSecretForm] = useState({ key: '', value: '', description: '' });
  const [oauthForm, setOauthForm] = useState({ name: '', scopes: 'integration:read' });
  const [policyForm, setPolicyForm] = useState({
    name: '',
    effect: 'allow' as 'allow' | 'deny',
    priority: '100',
    resourceType: 'household',
    actions: 'read',
    description: '',
  });
  const [createdSecretOnce, setCreatedSecretOnce] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [maskResult, setMaskResult] = useState<Record<string, unknown> | null>(null);
  const { loading, error, setError, run } = useQueryLoad();

  const canRead = hasPermission('security:read');
  const canWrite = hasPermission('security:write');
  const canSecrets = hasPermission('secrets:manage');
  const canOauth = hasPermission('oauth:manage');

  const load = useCallback(async () => {
    if (!canRead) return;
    await run(async () => {
      const o = await fetchSecurityOverview();
      if (o.success && o.data) setOverview(o.data);
      const p = await fetchAbacPolicies();
      if (p.success && p.data) setPolicies(p.data as never);
      const extra: Array<{ success?: boolean; error?: { message?: string } | null }> = [];
      if (canSecrets) {
        const s = await fetchSecrets();
        if (s.success && s.data) setSecrets(s.data);
        extra.push(s);
      }
      if (canOauth) {
        const c = await fetchOauthClients();
        if (c.success && c.data) setClients(c.data);
        extra.push(c);
      }
      const fail = firstQueryFailure([o, p, ...extra]);
      if (fail) setError(fail);
    });
  }, [canRead, canSecrets, canOauth, run, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpsertSecret(e: React.FormEvent) {
    e.preventDefault();
    const r = await upsertSecret(secretForm);
    if (r.success) {
      feedback.success('کلید محرمانه ذخیره شد. مقدار خام دیگر نمایش داده نمی‌شود.');
      setSecretForm({ key: '', value: '', description: '' });
      void load();
    } else {
      await feedback.alert(r.error?.message || 'ذخیره ناموفق بود', 'کلید محرمانه');
    }
  }

  async function onCreateOauth(e: React.FormEvent) {
    e.preventDefault();
    setCreatedSecretOnce(null);
    const r = await createOauthClient({
      name: oauthForm.name,
      scopes: oauthForm.scopes.split(',').map((s) => s.trim()).filter(Boolean),
    });
    if (r.success && r.data) {
      setCreatedSecretOnce(r.data.clientSecret || null);
      feedback.success(`اتصال «${r.data.name || oauthForm.name}» ساخته شد`);
      setOauthForm({ name: '', scopes: 'integration:read' });
      void load();
    } else {
      await feedback.alert(r.error?.message || 'ایجاد ناموفق بود', 'اتصال سامانه');
    }
  }

  async function onCreatePolicy(e: React.FormEvent) {
    e.preventDefault();
    const actions = policyForm.actions.split(',').map((s) => s.trim()).filter(Boolean);
    const r = await createAbacPolicy({
      name: policyForm.name.trim(),
      description: policyForm.description.trim() || undefined,
      effect: policyForm.effect,
      priority: Number(policyForm.priority) || 100,
      resourceType: policyForm.resourceType.trim(),
      actions: actions.length ? actions : ['*'],
    });
    if (!r.success) {
      await feedback.alert(r.error?.message || 'ایجاد سیاست ناموفق بود', 'ABAC');
      return;
    }
    feedback.success('سیاست ABAC ایجاد شد');
    setPolicyForm({
      name: '',
      effect: 'allow',
      priority: '100',
      resourceType: 'household',
      actions: 'read',
      description: '',
    });
    void load();
  }

  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <AppShell title="مرکز امنیت">
      <PermissionGate allow={canRead}>
        <PageHeader
          title="مرکز امنیت"
          description="مدیریت دسترسی‌ها، کلیدهای محرمانه، اتصال سامانه‌ها و وضعیت ممیزی"
        />

        <div className="sec-tabs" role="tablist" aria-label="بخش‌های مرکز امنیت">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`sec-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <strong>{t.label}</strong>
              <span>{t.hint}</span>
            </button>
          ))}
        </div>

        <p className="muted sec-tab-lead">{activeTab.hint}</p>

        <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={6} />} loadingLabel="در حال بارگذاری مرکز امنیت…">
        {tab === 'overview' && (
          <section className="sec-overview">
            {!overview ? (
              <div className="card"><EmptyState title="نمای کلی در دسترس نیست" /></div>
            ) : (
              <>
                <div className="sec-stat-grid">
                  <SecStat
                    icon="roles"
                    label="نقش‌های تعریف‌شده"
                    value={overview.rbac.roleCount}
                    hint="گروه‌های دسترسی کاربران"
                  />
                  <SecStat
                    icon="shield-admin"
                    label="مجوزهای سامانه"
                    value={overview.rbac.permissionCount}
                    hint="اقدامات قابل انجام در پنل"
                  />
                  <SecStat
                    icon="security"
                    label="قوانین دسترسی فعال"
                    value={overview.abac.activePolicies}
                    hint="محدودیت‌های ریز بر اساس شرایط"
                  />
                  <SecStat
                    icon="map"
                    label="کاربران محدود به منطقه"
                    value={overview.abac.geoScopedUsers}
                    hint="فقط محله/منطقه مشخص"
                  />
                  <SecStat
                    icon="activity"
                    label="رویداد ۲۴ ساعت اخیر"
                    value={overview.audit.last24h}
                    hint="ثبت فعالیت‌های سامانه"
                  />
                  <SecStat
                    icon="security"
                    label="دسترسی ردشده (۲۴س)"
                    value={overview.audit.deniedLast24h}
                    hint="تلاش‌های غیرمجاز"
                    tone="warning"
                  />
                  <SecStat
                    icon="settings"
                    label="کلیدهای محرمانه"
                    value={overview.secrets.managedCount}
                    hint="رمزها و توکن‌های سرویس"
                  />
                  <SecStat
                    icon="integrations"
                    label="اتصال فعال سامانه‌ها"
                    value={overview.oauth.activeClients}
                    hint="سامانه‌های مجاز به API"
                  />
                </div>
                <div className="card sec-note">
                  <NavIcon name="security" size={18} />
                  <p>
                    برای جزئیات رویدادها به «فعالیت‌های اخیر» بروید. نقش‌ها را از بخش «نقش‌ها و دسترسی‌ها»
                    و کلیدها/اتصال‌ها را از تب‌های همین صفحه مدیریت کنید.
                  </p>
                </div>
              </>
            )}
          </section>
        )}

        {tab === 'policies' && (
          <>
            {canWrite && (
              <div className="card sec-form-card">
                <div className="card-head">
                  <div>
                    <h3>سیاست ABAC جدید</h3>
                    <p className="muted">قانون پویا برای مجاز/غیرمجاز کردن دسترسی به منابع</p>
                  </div>
                </div>
                <form onSubmit={(e) => void onCreatePolicy(e)} className="sec-form-grid">
                  <label className="settings-field">
                    <span className="settings-field-label">{SECURITY_FIELDS.policyName.label}</span>
                    <input
                      placeholder={SECURITY_FIELDS.policyName.placeholder}
                      value={policyForm.name}
                      onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                      required
                    />
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label">اثر</span>
                    <select
                      value={policyForm.effect}
                      onChange={(e) => setPolicyForm({ ...policyForm, effect: e.target.value as 'allow' | 'deny' })}
                    >
                      <option value="allow">مجاز</option>
                      <option value="deny">غیرمجاز</option>
                    </select>
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label">اولویت</span>
                    <input
                      type="number"
                      value={policyForm.priority}
                      onChange={(e) => setPolicyForm({ ...policyForm, priority: e.target.value })}
                    />
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label">نوع منبع</span>
                    <input
                      dir="ltr"
                      value={policyForm.resourceType}
                      onChange={(e) => setPolicyForm({ ...policyForm, resourceType: e.target.value })}
                      placeholder="household"
                      required
                    />
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label">اقدام‌ها</span>
                    <input
                      dir="ltr"
                      value={policyForm.actions}
                      onChange={(e) => setPolicyForm({ ...policyForm, actions: e.target.value })}
                      placeholder="read, write"
                    />
                    <span className="settings-field-hint">با کاما جدا کنید؛ * برای همه</span>
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label">توضیح</span>
                    <input
                      value={policyForm.description}
                      onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })}
                      placeholder="اختیاری"
                    />
                  </label>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">ایجاد سیاست</button>
                  </div>
                </form>
              </div>
            )}
            <div className="card">
              <div className="card-head">
                <div>
                  <h3>قوانین دسترسی</h3>
                  <p className="muted">هر قانون مشخص می‌کند دسترسی به یک بخش مجاز است یا خیر</p>
                </div>
              </div>
              {policies.length === 0 ? (
                <EmptyState title="قانونی ثبت نشده" description="پس از راه‌اندازی اولیه، قوانین پایه ایجاد می‌شوند." />
              ) : (
                <div className="sec-policy-list">
                  {policies.map((p) => (
                    <article key={String(p.id)} className="sec-policy-item">
                      <header>
                        <strong>{String(p.name)}</strong>
                        <span className={`sec-badge ${String(p.effect) === 'deny' ? 'deny' : 'allow'}`}>
                          {EFFECT_LABEL[String(p.effect)] || String(p.effect)}
                        </span>
                      </header>
                      <dl>
                        <div><dt>اولویت</dt><dd>{formatNumber(Number(p.priority))}</dd></div>
                        <div><dt>بخش</dt><dd>{String(p.resourceType)}</dd></div>
                        <div>
                          <dt>اقدام‌ها</dt>
                          <dd>{Array.isArray(p.actions) ? (p.actions as string[]).join('، ') : '—'}</dd>
                        </div>
                        <div><dt>وضعیت</dt><dd>{p.isActive === false ? 'غیرفعال' : 'فعال'}</dd></div>
                      </dl>
                      {canWrite && (
                        <div className="regen-card-actions" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={async () => {
                              const next = !(p.isActive !== false);
                              const r = await updateAbacPolicy(String(p.id), { isActive: next });
                              if (r.success) {
                                feedback.success(next ? 'سیاست فعال شد' : 'سیاست غیرفعال شد');
                                void load();
                              } else {
                                await feedback.alert(r.error?.message || 'بروزرسانی ناموفق', 'ABAC');
                              }
                            }}
                          >
                            {p.isActive === false ? 'فعال‌سازی' : 'غیرفعال'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={async () => {
                              const okConfirm = await feedback.confirm(`سیاست «${String(p.name)}» حذف شود؟`, 'حذف ABAC');
                              if (!okConfirm) return;
                              const r = await deleteAbacPolicy(String(p.id));
                              if (r.success) {
                                feedback.success('سیاست حذف شد');
                                void load();
                              } else {
                                await feedback.alert(r.error?.message || 'حذف ناموفق', 'ABAC');
                              }
                            }}
                          >
                            حذف
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'secrets' && (
          <PermissionGate allow={canSecrets}>
            <div className="card sec-form-card">
              <div className="card-head">
                <div>
                  <h3>ثبت کلید محرمانه</h3>
                  <p className="muted">مثلاً کلید پیامک یا توکن سرویس — مقدار بعد از ذخیره دیده نمی‌شود</p>
                </div>
              </div>
              <form onSubmit={onUpsertSecret} className="sec-form-grid">
                <label className="settings-field">
                  <span className="settings-field-label">{SECURITY_FIELDS.secretKey.label}</span>
                  <input
                    placeholder={SECURITY_FIELDS.secretKey.placeholder}
                    title={SECURITY_FIELDS.secretKey.hint}
                    dir={SECURITY_FIELDS.secretKey.dir}
                    value={secretForm.key}
                    onChange={(e) => setSecretForm({ ...secretForm, key: e.target.value })}
                    required
                  />
                  {SECURITY_FIELDS.secretKey.hint && (
                    <span className="settings-field-hint">{SECURITY_FIELDS.secretKey.hint}</span>
                  )}
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">{SECURITY_FIELDS.secretValue.label}</span>
                  <input
                    placeholder={SECURITY_FIELDS.secretValue.placeholder}
                    type="password"
                    autoComplete={SECURITY_FIELDS.secretValue.autoComplete}
                    dir={SECURITY_FIELDS.secretValue.dir}
                    value={secretForm.value}
                    onChange={(e) => setSecretForm({ ...secretForm, value: e.target.value })}
                    required
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">توضیح کوتاه</span>
                  <input
                    placeholder="اختیاری"
                    value={secretForm.description}
                    onChange={(e) => setSecretForm({ ...secretForm, description: e.target.value })}
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">ذخیره امن</button>
                </div>
              </form>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 12 }}>کلیدهای ذخیره‌شده</h3>
              {secrets.length === 0 ? (
                <EmptyState title="کلیدی ثبت نشده" />
              ) : (
                <ul className="sec-simple-list">
                  {secrets.map((s) => (
                    <li key={s.id}>
                      <div>
                        <strong>{s.key}</strong>
                        <small>
                          نسخه {formatNumber(s.keyVersion)}
                          {s.rotatedAt ? ` · آخرین تغییر ${formatDateTime(s.rotatedAt)}` : ''}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={async () => {
                          const ok = await feedback.confirm(`کلید «${s.key}» حذف شود؟`, 'حذف کلید');
                          if (!ok) return;
                          await deleteSecret(s.key);
                          feedback.success('کلید حذف شد');
                          void load();
                        }}
                      >
                        حذف
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PermissionGate>
        )}

        {tab === 'oauth' && (
          <PermissionGate allow={canOauth}>
            <div className="card sec-form-card">
              <div className="card-head">
                <div>
                  <h3>اتصال سامانه بیرونی</h3>
                  <p className="muted">برای سرویس‌هایی که باید به API دسترسی داشته باشند</p>
                </div>
              </div>
              <form onSubmit={onCreateOauth} className="sec-form-rows">
                <label className="settings-field sec-form-row">
                  <span className="settings-field-label">{SECURITY_FIELDS.oauthClientName.label}</span>
                  <input
                    placeholder={SECURITY_FIELDS.oauthClientName.placeholder}
                    value={oauthForm.name}
                    onChange={(e) => setOauthForm({ ...oauthForm, name: e.target.value })}
                    required
                  />
                </label>
                <label className="settings-field sec-form-row">
                  <span className="settings-field-label">محدوده دسترسی</span>
                  <input
                    className="input-ltr"
                    placeholder="integration:read"
                    value={oauthForm.scopes}
                    onChange={(e) => setOauthForm({ ...oauthForm, scopes: e.target.value })}
                  />
                  <span className="settings-field-hint">در صورت چند مورد، با کاما جدا کنید</span>
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">ایجاد اتصال</button>
                </div>
              </form>
              {createdSecretOnce && (
                <div className="sec-secret-once">
                  <strong>رمز اتصال (فقط همین یک‌بار نمایش داده می‌شود)</strong>
                  <code>{createdSecretOnce}</code>
                  <p className="muted">آن را در جای امن کپی کنید؛ بعداً قابل مشاهده نیست.</p>
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 12 }}>اتصال‌های ثبت‌شده</h3>
              {clients.length === 0 ? (
                <EmptyState title="اتصالی ثبت نشده" />
              ) : (
                <ul className="sec-simple-list">
                  {clients.map((c) => (
                    <li key={c.id}>
                      <div>
                        <strong>{c.name}</strong>
                        <small>
                          {c.isActive ? 'فعال' : 'غیرفعال'}
                          {' · '}
                          شناسه: {c.clientId}
                          {c.scopes?.length ? ` · دسترسی: ${c.scopes.join('، ')}` : ''}
                        </small>
                      </div>
                      {c.isActive && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={async () => {
                            const ok = await feedback.confirm(
                              `اتصال «${c.name}» غیرفعال شود؟`,
                              'قطع دسترسی',
                            );
                            if (!ok) return;
                            await revokeOauthClient(c.id);
                            feedback.success('اتصال غیرفعال شد');
                            void load();
                          }}
                        >
                          قطع دسترسی
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PermissionGate>
        )}

        {tab === 'tools' && (
          <div className="sec-tools-grid">
            <div className="card">
              <h3>بررسی دسترسی</h3>
              <p className="muted">آیا کاربر جاری می‌تواند داده خانوار را ببیند؟</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  const r = await evaluateAbac({
                    resource: { type: 'household' },
                    action: 'read',
                  });
                  if (r.success && r.data) {
                    const allowed = Boolean(r.data.allow);
                    setEvalResult({
                      ok: allowed,
                      text: allowed
                        ? (r.data.reason || 'دسترسی مجاز است.')
                        : (r.data.reason || 'دسترسی مجاز نیست.'),
                    });
                  } else {
                    setEvalResult({
                      ok: false,
                      text: r.error?.message || 'نتیجه نامشخص بود.',
                    });
                  }
                }}
              >
                اجرای بررسی
              </button>
              {evalResult && (
                <p className={`sec-tool-result ${evalResult.ok ? 'ok' : 'fail'}`}>{evalResult.text}</p>
              )}
            </div>

            <div className="card">
              <h3>پیش‌نمایش مخفی‌سازی داده</h3>
              <p className="muted">نمونه کد ملی و تلفن قبل و بعد از مخفی‌سازی</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  const sample = {
                    nationalId: '0012345678',
                    phone: '09121234567',
                    incomeAmount: 45000000,
                    name: 'نمونه',
                  };
                  const r = await previewMasking(sample);
                  if (r.success && r.data) {
                    setMaskResult(r.data as Record<string, unknown>);
                  } else {
                    await feedback.alert(r.error?.message || 'خطا در پیش‌نمایش', 'مخفی‌سازی');
                  }
                }}
              >
                نمایش نمونه
              </button>
              {maskResult && (
                <dl className="sec-mask-preview">
                  {Object.entries(maskResult).map(([k, v]) => (
                    <div key={k}>
                      <dt>{fieldLabel(k)}</dt>
                      <dd>{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        )}
        </QueryState>
      </PermissionGate>
    </AppShell>
  );
}

function fieldLabel(key: string) {
  const map: Record<string, string> = {
    nationalId: 'کد ملی',
    phone: 'تلفن',
    incomeAmount: 'درآمد',
    name: 'نام',
  };
  return map[key] || key;
}

function SecStat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  hint: string;
  tone?: 'warning';
}) {
  return (
    <div className={`card sec-stat ${tone === 'warning' ? 'tone-warning' : ''}`}>
      <div className="sec-stat-icon"><NavIcon name={icon} size={18} /></div>
      <div className="sec-stat-body">
        <span>{label}</span>
        <strong>{formatNumber(value)}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}
