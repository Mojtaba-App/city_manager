'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader, PermissionGate, EmptyState, StatCard } from '@/components/admin/AdminUi';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/components/ui/Feedback';
import {
  fetchConnectors, fetchConnector, createConnector, updateConnector, deleteConnector,
  saveMappings, testConnector, syncConnector, queueSyncConnector,
  fetchSyncJobs, fetchQueue, processQueue, fetchDlq, requeueDlq, fetchWebhookEvents, fetchIntegrationDocs,
  publicWebhookUrl, docsEndpointUrl, ConnectorRow, ConnectorType, SyncDirection, AuthType,
  IntegrationTargetEntity, CONNECTOR_TYPE_LABELS, SYNC_STATUS_LABELS,
  SYNC_DIRECTION_LABELS, AUTH_TYPE_LABELS, TARGET_ENTITY_LABELS, QUEUE_STATUS_LABELS,
  API_URL,
} from '@/lib/integration-api';
import { formatDateTime, formatNumber } from '@/lib/format';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';
import { INTEGRATION_FIELDS } from '@city-manager/shared';

type Tab = 'connectors' | 'detail' | 'jobs' | 'queue' | 'dlq' | 'webhooks' | 'docs';

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: 'connectors', label: 'کانکتورها', hint: 'پروفایل اتصال و وضعیت سلامت' },
  { id: 'jobs', label: 'وضعیت Sync', hint: 'تاریخچه همگام‌سازی' },
  { id: 'queue', label: 'صف Retry', hint: 'تلاش مجدد خودکار' },
  { id: 'dlq', label: 'DLQ', hint: 'رکوردهای ناموفق نهایی' },
  { id: 'webhooks', label: 'Webhook', hint: 'رویدادهای دریافتی' },
  { id: 'docs', label: 'مستندات API', hint: 'لینک‌ها و نقاط پایانی' },
];

const emptyForm = {
  code: '',
  name: '',
  description: '',
  connectorType: ConnectorType.REST_API,
  syncDirection: SyncDirection.INBOUND,
  targetEntity: IntegrationTargetEntity.HOUSEHOLD,
  scheduleIntervalMinutes: '',
  baseUrl: '',
  csvUrl: '',
  healthPath: '/health',
  listPath: '/api/items',
  authType: AuthType.BEARER,
  bearerToken: '',
  apiKey: '',
  username: '',
  password: '',
  webhookSecret: '',
  timeoutMs: '15000',
  maxAttempts: '3',
  backoffMs: '2000',
};

function LtrLink({
  href,
  children,
  copyLabel = 'کپی',
}: {
  href: string;
  children?: React.ReactNode;
  copyLabel?: string;
}) {
  const feedback = useFeedback();
  const isHttp = /^https?:\/\//i.test(href);
  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      feedback.success('لینک کپی شد');
    } catch {
      await feedback.alert('کپی لینک ممکن نشد', 'لینک');
    }
  }
  return (
    <div className="int-ltr-link">
      {isHttp ? (
        <a href={href} target="_blank" rel="noreferrer" className="int-ltr-link-text" dir="ltr">
          {children ?? href}
        </a>
      ) : (
        <code className="int-ltr-link-text" dir="ltr">{children ?? href}</code>
      )}
      <button type="button" className="btn btn-sm" onClick={() => void copy()}>{copyLabel}</button>
    </div>
  );
}

function LtrCode({ value }: { value: string }) {
  if (!value || value === '—') return <span className="muted">—</span>;
  return <code className="int-ltr-code" dir="ltr">{value}</code>;
}

export default function IntegrationsPage() {
  const { hasPermission } = useAuth();
  const feedback = useFeedback();
  const [tab, setTab] = useState<Tab>('connectors');
  const [items, setItems] = useState<ConnectorRow[]>([]);
  const [selected, setSelected] = useState<ConnectorRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [mappingsText, setMappingsText] = useState('[\n  {"sourceField":"id","targetField":"externalId","isRequired":true},\n  {"sourceField":"full_name","targetField":"fullName"}\n]');
  const [jobs, setJobs] = useState<unknown[]>([]);
  const [queue, setQueue] = useState<unknown[]>([]);
  const [dlq, setDlq] = useState<unknown[]>([]);
  const [events, setEvents] = useState<unknown[]>([]);
  const [docs, setDocs] = useState<{ endpoints: Array<{ method: string; path: string; desc: string }>; authNotes: string[] } | null>(null);
  const [testResult, setTestResult] = useState('');
  const [busy, setBusy] = useState(false);
  const { loading, error, setError, run } = useQueryLoad();

  const canWrite = hasPermission('integration:write');
  const canExecute = hasPermission('integration:execute');

  async function loadList() {
    await run(async () => {
      const res = await fetchConnectors();
      if (res.success && res.data) setItems(res.data);
      else if (!res.success) setError(res.error?.message ?? 'بارگذاری کانکتورها ناموفق بود');
    });
  }

  useEffect(() => {
    if (!hasPermission('integration:read')) return;
    void loadList();
  }, [hasPermission]);

  const stats = useMemo(() => {
    const healthy = items.filter((c) => c.lastTestOk === true).length;
    const unhealthy = items.filter((c) => c.lastTestOk === false).length;
    const scheduled = items.filter((c) => (c.scheduleIntervalMinutes ?? 0) > 0).length;
    const active = items.filter((c) => c.isActive).length;
    return { total: items.length, healthy, unhealthy, scheduled, active };
  }, [items]);

  async function openDetail(id: string) {
    const res = await fetchConnector(id);
    if (res.success && res.data) {
      setSelected(res.data);
      if (res.data.mappings?.length) {
        setMappingsText(JSON.stringify(res.data.mappings.map((m) => ({
          sourceField: m.sourceField,
          targetField: m.targetField,
          isRequired: m.isRequired,
          transformRule: m.transformRule,
        })), null, 2));
      }
      setTab('detail');
      setTestResult('');
    } else {
      await feedback.alert(res.error?.message ?? 'بارگذاری جزئیات ناموفق بود', 'کانکتور');
    }
  }

  async function selectTab(next: Tab) {
    if (next === 'connectors') {
      setSelected(null);
      setTab('connectors');
      void loadList();
      return;
    }
    if (next === 'jobs') {
      const res = await fetchSyncJobs(selected?.id);
      if (res.success && res.data) setJobs(res.data as unknown[]);
      setTab('jobs');
      return;
    }
    if (next === 'queue') {
      const res = await fetchQueue();
      if (res.success && res.data) setQueue(res.data as unknown[]);
      setTab('queue');
      return;
    }
    if (next === 'dlq') {
      const res = await fetchDlq();
      if (res.success && res.data) setDlq(res.data as unknown[]);
      else if (!res.success) await feedback.alert(res.error?.message ?? 'بارگذاری DLQ ناموفق', 'DLQ');
      setTab('dlq');
      return;
    }
    if (next === 'webhooks') {
      const res = await fetchWebhookEvents(selected?.id);
      if (res.success && res.data) setEvents(res.data as unknown[]);
      setTab('webhooks');
      return;
    }
    if (next === 'docs') {
      const res = await fetchIntegrationDocs();
      if (res.success && res.data) setDocs(res.data);
      setTab('docs');
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await createConnector({
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        connectorType: form.connectorType,
        syncDirection: form.syncDirection,
        targetEntity: form.targetEntity,
        scheduleIntervalMinutes: form.scheduleIntervalMinutes ? Number(form.scheduleIntervalMinutes) : undefined,
        profile: {
          baseUrl: form.baseUrl || undefined,
          csvUrl: form.csvUrl || undefined,
          endpoints: {
            health: form.healthPath || undefined,
            list: form.listPath || undefined,
          },
          timeoutMs: Number(form.timeoutMs) || 15000,
          retry: {
            maxAttempts: Number(form.maxAttempts) || 3,
            backoffMs: Number(form.backoffMs) || 2000,
            backoffMultiplier: 2,
          },
          auth: {
            type: form.authType,
            bearerToken: form.bearerToken || undefined,
            apiKey: form.apiKey || undefined,
            username: form.username || undefined,
            password: form.password || undefined,
          },
          webhookSecret: form.webhookSecret || undefined,
        },
      });
      if (!res.success) {
        await feedback.alert(res.error?.message ?? 'خطا در ایجاد', 'کانکتور جدید');
        return;
      }
      setShowForm(false);
      setForm(emptyForm);
      feedback.success('کانکتور ایجاد شد');
      void loadList();
      setTab('connectors');
    } finally {
      setBusy(false);
    }
  }

  async function saveMaps() {
    if (!selected) return;
    try {
      const mappings = JSON.parse(mappingsText) as Array<Record<string, unknown>>;
      const res = await saveMappings(selected.id, mappings);
      if (res.success) {
        feedback.success('نگاشت فیلدها ذخیره شد');
        void openDetail(selected.id);
      } else {
        await feedback.alert(res.error?.message ?? 'خطا', 'نگاشت فیلد');
      }
    } catch {
      await feedback.alert('JSON نگاشت نامعتبر است', 'نگاشت فیلد');
    }
  }

  async function runTest() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await testConnector(selected.id);
      if (res.success && res.data) {
        const text = `${res.data.ok ? '✓ موفق' : '✗ ناموفق'} — ${res.data.message} (${formatNumber(res.data.latencyMs ?? 0)}ms)`;
        setTestResult(text);
        if (res.data.ok) feedback.success(text);
        else await feedback.alert(text, 'تست اتصال');
        void openDetail(selected.id);
        void loadList();
      } else {
        setTestResult(res.error?.message ?? 'خطای تست');
        await feedback.alert(res.error?.message ?? 'خطای تست', 'تست اتصال');
      }
    } finally {
      setBusy(false);
    }
  }

  async function runSync() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await syncConnector(selected.id);
      if (res.success) feedback.success('همگام‌سازی اجرا شد');
      else await feedback.alert(res.error?.message ?? 'خطا', 'همگام‌سازی');
      void openDetail(selected.id);
      void loadList();
    } finally {
      setBusy(false);
    }
  }

  async function enqueue() {
    if (!selected) return;
    const res = await queueSyncConnector(selected.id);
    if (res.success) feedback.success('در صف Retry قرار گرفت');
    else await feedback.alert(res.error?.message ?? 'خطا', 'صف Retry');
  }

  async function onDelete() {
    if (!selected) return;
    const ok = await feedback.confirm(
      `کانکتور «${selected.name}» حذف شود؟ این کار قابل بازگشت نیست.`,
      'حذف کانکتور',
      { confirmLabel: 'حذف', cancelLabel: 'انصراف' },
    );
    if (!ok) return;
    const res = await deleteConnector(selected.id);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'حذف ناموفق بود', 'حذف کانکتور');
      return;
    }
    feedback.success('کانکتور حذف شد');
    setSelected(null);
    setTab('connectors');
    void loadList();
  }

  const activeTabMeta = TABS.find((t) => t.id === (tab === 'detail' ? 'connectors' : tab)) ?? TABS[0];
  const webhookTemplate = `${API_URL}/integrations/webhooks/:orgId/:code`;

  return (
    <AppShell title="یکپارچه‌سازی">
      <PermissionGate allow={hasPermission('integration:read')}>
        <PageHeader
          title="اتصال به سامانه‌های بیرونی"
          description="پروفایل اتصال، تست، نگاشت فیلد، همگام‌سازی زمان‌بندی‌شده، Webhook و صف Retry"
          actions={
            canWrite ? (
              <button type="button" className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
                {showForm ? 'بستن فرم' : '+ کانکتور جدید'}
              </button>
            ) : undefined
          }
        />

        <div className="int-stat-grid" aria-label="خلاصه وضعیت یکپارچه‌سازی">
          <StatCard label="کانکتورها" value={stats.total} hint={`${formatNumber(stats.active)} فعال`} tone="info" />
          <StatCard label="سالم" value={stats.healthy} hint="آخرین تست موفق" tone="success" />
          <StatCard label="نیازمند توجه" value={stats.unhealthy} hint="آخرین تست ناموفق" tone={stats.unhealthy ? 'warning' : 'default'} />
          <StatCard label="زمان‌بندی‌شده" value={stats.scheduled} hint="Sync دوره‌ای" tone="info" />
        </div>

        <div className="sec-tabs int-tabs" role="tablist" aria-label="بخش‌های یکپارچه‌سازی">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id || (t.id === 'connectors' && tab === 'detail')}
              className={`sec-tab ${(tab === t.id || (t.id === 'connectors' && tab === 'detail')) ? 'active' : ''}`}
              onClick={() => void selectTab(t.id)}
            >
              <strong>{t.label}</strong>
              <span>{t.hint}</span>
            </button>
          ))}
        </div>

        <p className="muted sec-tab-lead">{activeTabMeta.hint}</p>

        {showForm && (
          <form className="card form-grid int-create-form" onSubmit={(e) => void submitCreate(e)}>
            <div className="form-full int-section-head">
              <h3>ایجاد پروفایل اتصال</h3>
              <p className="muted">آدرس‌ها و مسیرها به‌صورت LTR ذخیره و نمایش داده می‌شوند.</p>
            </div>
            <label className="form-group"><span>{INTEGRATION_FIELDS.code.label} *</span><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={INTEGRATION_FIELDS.code.placeholder} dir={INTEGRATION_FIELDS.code.dir} className="int-ltr-input" /></label>
            <label className="form-group"><span>{INTEGRATION_FIELDS.name.label} *</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={INTEGRATION_FIELDS.name.placeholder} /></label>
            <label className="form-group">
              <span>نوع</span>
              <select value={form.connectorType} onChange={(e) => setForm({ ...form, connectorType: e.target.value as ConnectorType })}>
                {Object.values(ConnectorType).map((t) => <option key={t} value={t}>{CONNECTOR_TYPE_LABELS[t]}</option>)}
              </select>
            </label>
            <label className="form-group">
              <span>جهت Sync</span>
              <select value={form.syncDirection} onChange={(e) => setForm({ ...form, syncDirection: e.target.value as SyncDirection })}>
                {Object.values(SyncDirection).map((t) => <option key={t} value={t}>{SYNC_DIRECTION_LABELS[t]}</option>)}
              </select>
            </label>
            <label className="form-group">
              <span>موجودیت هدف</span>
              <select value={form.targetEntity} onChange={(e) => setForm({ ...form, targetEntity: e.target.value as IntegrationTargetEntity })}>
                {Object.values(IntegrationTargetEntity).map((t) => <option key={t} value={t}>{TARGET_ENTITY_LABELS[t]}</option>)}
              </select>
            </label>
            <label className="form-group"><span>بازه زمان‌بندی (دقیقه)</span><input type="number" min={0} value={form.scheduleIntervalMinutes} onChange={(e) => setForm({ ...form, scheduleIntervalMinutes: e.target.value })} placeholder="60" /></label>
            <label className="form-group form-full"><span>{INTEGRATION_FIELDS.baseUrl.label}</span><input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder={INTEGRATION_FIELDS.baseUrl.placeholder} title={INTEGRATION_FIELDS.baseUrl.hint} dir={INTEGRATION_FIELDS.baseUrl.dir} className="int-ltr-input" /></label>
            <label className="form-group form-full"><span>{INTEGRATION_FIELDS.csvUrl.label}</span><input value={form.csvUrl} onChange={(e) => setForm({ ...form, csvUrl: e.target.value })} placeholder={INTEGRATION_FIELDS.csvUrl.placeholder} title={INTEGRATION_FIELDS.csvUrl.hint} dir={INTEGRATION_FIELDS.csvUrl.dir} className="int-ltr-input" /></label>
            <label className="form-group"><span>Health path</span><input value={form.healthPath} onChange={(e) => setForm({ ...form, healthPath: e.target.value })} dir="ltr" className="int-ltr-input" /></label>
            <label className="form-group"><span>List path</span><input value={form.listPath} onChange={(e) => setForm({ ...form, listPath: e.target.value })} dir="ltr" className="int-ltr-input" /></label>
            <label className="form-group">
              <span>احراز هویت</span>
              <select value={form.authType} onChange={(e) => setForm({ ...form, authType: e.target.value as AuthType })}>
                {Object.values(AuthType).map((t) => <option key={t} value={t}>{AUTH_TYPE_LABELS[t]}</option>)}
              </select>
            </label>
            <label className="form-group"><span>Bearer Token</span><input type="password" value={form.bearerToken} onChange={(e) => setForm({ ...form, bearerToken: e.target.value })} dir="ltr" className="int-ltr-input" /></label>
            <label className="form-group"><span>API Key</span><input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} dir="ltr" className="int-ltr-input" /></label>
            <label className="form-group"><span>Username</span><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} dir="ltr" className="int-ltr-input" /></label>
            <label className="form-group"><span>Password</span><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" className="int-ltr-input" /></label>
            <label className="form-group"><span>{INTEGRATION_FIELDS.webhookSecret.label}</span><input type="password" value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })} dir={INTEGRATION_FIELDS.webhookSecret.dir} className="int-ltr-input" /></label>
            <label className="form-group"><span>Timeout (ms)</span><input value={form.timeoutMs} onChange={(e) => setForm({ ...form, timeoutMs: e.target.value })} /></label>
            <label className="form-group"><span>Retry max</span><input value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })} /></label>
            <label className="form-group"><span>Backoff (ms)</span><input value={form.backoffMs} onChange={(e) => setForm({ ...form, backoffMs: e.target.value })} /></label>
            <label className="form-group form-full"><span>توضیح</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="form-full form-actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'در حال ذخیره…' : 'ذخیره کانکتور'}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>انصراف</button>
            </div>
          </form>
        )}

        {(tab === 'connectors') && (
          <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={5} />} loadingLabel="در حال بارگذاری کانکتورها…">
            <div className="card int-panel">
              {items.length === 0 ? (
                <EmptyState title="کانکتوری ثبت نشده" description="یک پروفایل REST یا Webhook ایجاد کنید تا همگام‌سازی و رویدادها فعال شوند." />
              ) : (
                <div className="int-connector-list">
                  {items.map((c) => {
                    const wh = publicWebhookUrl(c.code, c.organizationId);
                    return (
                      <article key={c.id} className={`int-connector-card${c.isActive ? '' : ' is-inactive'}`}>
                        <div className="int-connector-main">
                          <div className="int-connector-title">
                            <h3>{c.name}</h3>
                            <code className="int-ltr-code" dir="ltr">{c.code}</code>
                          </div>
                          <div className="int-connector-meta">
                            <span className="int-chip">{CONNECTOR_TYPE_LABELS[c.connectorType as ConnectorType] || c.connectorType}</span>
                            <span className="int-chip">{SYNC_DIRECTION_LABELS[c.syncDirection as SyncDirection] || c.syncDirection}</span>
                            <span className="int-chip">{TARGET_ENTITY_LABELS[c.targetEntity as IntegrationTargetEntity] || c.targetEntity}</span>
                            <span className={`status-pill ${c.lastTestOk ? 'ok' : c.lastTestOk === false ? 'off' : 'info'}`}>
                              {c.lastTestOk == null ? 'تست نشده' : c.lastTestOk ? 'سالم' : 'خطا'}
                            </span>
                            {!c.isActive && <span className="status-pill off">غیرفعال</span>}
                          </div>
                          <dl className="int-mini-grid">
                            <div>
                              <dt>آخرین Sync</dt>
                              <dd>
                                {c.lastSyncStatus
                                  ? (SYNC_STATUS_LABELS[c.lastSyncStatus as keyof typeof SYNC_STATUS_LABELS] || c.lastSyncStatus)
                                  : '—'}
                                {c.lastSyncAt ? <small className="muted"> · {formatDateTime(c.lastSyncAt)}</small> : null}
                              </dd>
                            </div>
                            <div>
                              <dt>زمان‌بندی</dt>
                              <dd>{c.scheduleIntervalMinutes ? `هر ${formatNumber(c.scheduleIntervalMinutes)} دقیقه` : 'دستی'}</dd>
                            </div>
                            <div className="int-mini-grid-span">
                              <dt>Webhook</dt>
                              <dd><LtrLink href={wh} /></dd>
                            </div>
                          </dl>
                        </div>
                        <div className="int-connector-actions">
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => void openDetail(c.id)}>مدیریت</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </QueryState>
        )}

        {tab === 'detail' && selected && (
          <div className="admin-two-col int-detail">
            <div className="card int-panel">
              <div className="card-head">
                <div>
                  <button type="button" className="btn btn-sm int-back" onClick={() => void selectTab('connectors')}>← بازگشت به فهرست</button>
                  <h3>{selected.name}</h3>
                  <p className="muted">
                    <code className="int-ltr-code" dir="ltr">{selected.code}</code>
                    {' · '}
                    {CONNECTOR_TYPE_LABELS[selected.connectorType as ConnectorType] || selected.connectorType}
                  </p>
                </div>
                {canWrite && (
                  <button type="button" className="btn btn-sm" onClick={() => void onDelete()}>حذف</button>
                )}
              </div>

              <dl className="int-detail-grid">
                <div>
                  <dt>Base URL</dt>
                  <dd>{selected.profile?.baseUrl ? <LtrLink href={selected.profile.baseUrl} /> : <span className="muted">—</span>}</dd>
                </div>
                <div>
                  <dt>Health</dt>
                  <dd><LtrCode value={selected.profile?.endpoints?.health || '—'} /></dd>
                </div>
                <div>
                  <dt>List</dt>
                  <dd><LtrCode value={selected.profile?.endpoints?.list || '—'} /></dd>
                </div>
                <div>
                  <dt>احراز هویت</dt>
                  <dd>{AUTH_TYPE_LABELS[selected.profile?.auth?.type as AuthType] || selected.profile?.auth?.type || 'none'}</dd>
                </div>
                <div>
                  <dt>جهت Sync</dt>
                  <dd>{SYNC_DIRECTION_LABELS[selected.syncDirection as SyncDirection] || selected.syncDirection}</dd>
                </div>
                <div>
                  <dt>موجودیت هدف</dt>
                  <dd>{TARGET_ENTITY_LABELS[selected.targetEntity as IntegrationTargetEntity] || selected.targetEntity}</dd>
                </div>
                <div className="int-detail-span">
                  <dt>Webhook URL</dt>
                  <dd><LtrLink href={publicWebhookUrl(selected.code, selected.organizationId)} /></dd>
                </div>
                <div className="int-detail-span">
                  <dt>آخرین تست</dt>
                  <dd>
                    {selected.lastTestMessage || '—'}
                    {selected.lastTestAt ? <small className="muted"> ({formatDateTime(selected.lastTestAt)})</small> : null}
                  </dd>
                </div>
              </dl>

              {canExecute && (
                <div className="form-actions int-action-row">
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void runTest()}>تست اتصال</button>
                  <button type="button" className="btn" disabled={busy} onClick={() => void runSync()}>اجرای Sync</button>
                  <button type="button" className="btn" disabled={busy} onClick={() => void enqueue()}>افزودن به صف Retry</button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={async () => {
                      await updateConnector(selected.id, { isActive: !selected.isActive });
                      feedback.success(selected.isActive ? 'کانکتور غیرفعال شد' : 'کانکتور فعال شد');
                      void openDetail(selected.id);
                      void loadList();
                    }}
                  >
                    {selected.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                  </button>
                </div>
              )}
              {testResult && <p className={`int-test-result ${testResult.includes('✓') ? 'ok' : 'bad'}`} role="status">{testResult}</p>}
            </div>

            <div className="card int-panel">
              <div className="int-section-head">
                <h3>نگاشت فیلدها</h3>
                <p className="muted">آرایه JSON از <code dir="ltr">sourceField → targetField</code></p>
              </div>
              <textarea
                className="settings-editor int-mapping-editor"
                rows={14}
                value={mappingsText}
                onChange={(e) => setMappingsText(e.target.value)}
                dir="ltr"
                spellCheck={false}
              />
              {canWrite && (
                <div className="form-actions">
                  <button type="button" className="btn btn-primary" onClick={() => void saveMaps()}>ذخیره نگاشت</button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'jobs' && (
          <div className="card int-panel">
            <div className="int-section-head">
              <h3>تاریخچه همگام‌سازی</h3>
              <p className="muted">{selected ? `فیلتر کانکتور: ${selected.name}` : 'همه کانکتورها'}</p>
            </div>
            {jobs.length === 0 ? <EmptyState title="جابلی ثبت نشده" description="پس از اجرای Sync، وضعیت اینجا دیده می‌شود." /> : (
              <div className="int-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>زمان</th><th>وضعیت</th><th>خوانده</th><th>نوشته</th><th>خطا</th><th>نوع</th></tr></thead>
                  <tbody>
                    {jobs.map((j) => {
                      const row = j as Record<string, unknown>;
                      return (
                        <tr key={String(row.id)}>
                          <td>{formatDateTime(row.createdAt as string)}</td>
                          <td>
                            <span className={`status-pill ${String(row.status) === 'success' ? 'ok' : String(row.status) === 'failed' ? 'off' : 'info'}`}>
                              {SYNC_STATUS_LABELS[String(row.status) as keyof typeof SYNC_STATUS_LABELS] || String(row.status)}
                            </span>
                          </td>
                          <td>{formatNumber(Number(row.recordsRead ?? 0))}</td>
                          <td>{formatNumber(Number(row.recordsWritten ?? 0))}</td>
                          <td>{formatNumber(Number(row.recordsFailed ?? 0))}</td>
                          <td><code className="int-ltr-code" dir="ltr">{String(row.triggerType)}</code></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'queue' && (
          <div className="card int-panel">
            <div className="card-head">
              <div className="int-section-head" style={{ margin: 0 }}>
                <h3>صف Retry</h3>
                <p className="muted">تلاش‌های ناموفق برای پردازش مجدد</p>
              </div>
              {canExecute && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    const res = await processQueue();
                    if (res.success) feedback.success('پردازش صف اجرا شد');
                    else await feedback.alert(res.error?.message ?? 'خطا', 'صف Retry');
                    void selectTab('queue');
                  }}
                >
                  پردازش صف
                </button>
              )}
            </div>
            {queue.length === 0 ? <EmptyState title="صف خالی است" description="موردی برای retry وجود ندارد." /> : (
              <div className="int-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>وضعیت</th><th>تلاش</th><th>بعدی</th><th>خطا</th></tr></thead>
                  <tbody>
                    {queue.map((q) => {
                      const row = q as Record<string, unknown>;
                      const status = String(row.status);
                      return (
                        <tr key={String(row.id)}>
                          <td>{QUEUE_STATUS_LABELS[status as keyof typeof QUEUE_STATUS_LABELS] || status}</td>
                          <td dir="ltr">{formatNumber(Number(row.attempt))}/{formatNumber(Number(row.maxAttempts))}</td>
                          <td>{formatDateTime(row.nextAttemptAt as string | undefined)}</td>
                          <td className="muted">{String(row.lastError ?? '—')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'dlq' && (
          <div className="card int-panel">
            <div className="card-head">
              <div className="int-section-head" style={{ margin: 0 }}>
                <h3>Dead Letter Queue</h3>
                <p className="muted">رکوردهایی که پس از حداکثر تلاش شکست خورده‌اند</p>
              </div>
              <button type="button" className="btn" onClick={() => void selectTab('dlq')}>بروزرسانی</button>
            </div>
            {dlq.length === 0 ? <EmptyState title="DLQ خالی است" description="مورد ناموفق نهایی‌ای ثبت نشده." /> : (
              <div className="int-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>زمان</th><th>موجودیت</th><th>خطا</th><th>اقدام</th></tr></thead>
                  <tbody>
                    {dlq.map((item) => {
                      const row = item as Record<string, unknown>;
                      return (
                        <tr key={String(row.id)}>
                          <td>{formatDateTime(row.createdAt as string | undefined)}</td>
                          <td><code className="int-ltr-code" dir="ltr">{String(row.entityType ?? '—')}</code></td>
                          <td className="muted">{String(row.errorMessage ?? '—')}</td>
                          <td>
                            {canExecute && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={async () => {
                                  const res = await requeueDlq(String(row.id));
                                  if (res.success) {
                                    feedback.success('به صف Retry برگشت');
                                    void selectTab('dlq');
                                  } else {
                                    await feedback.alert(res.error?.message ?? 'خطا', 'DLQ');
                                  }
                                }}
                              >
                                Requeue
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'webhooks' && (
          <div className="card int-panel">
            <div className="int-section-head">
              <h3>رویدادهای Webhook دریافتی</h3>
              <p className="muted">آدرس عمومی الگو:</p>
              <LtrLink href={webhookTemplate} copyLabel="کپی الگو" />
            </div>
            {events.length === 0 ? <EmptyState title="رویدادی نیست" description="پس از دریافت webhook، رویدادها اینجا فهرست می‌شوند." /> : (
              <div className="int-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>زمان</th><th>نوع</th><th>وضعیت</th><th>امضا</th></tr></thead>
                  <tbody>
                    {events.map((ev) => {
                      const row = ev as Record<string, unknown>;
                      return (
                        <tr key={String(row.id)}>
                          <td>{formatDateTime(row.receivedAt as string)}</td>
                          <td><code className="int-ltr-code" dir="ltr">{String(row.eventType ?? '—')}</code></td>
                          <td>{String(row.processingStatus)}</td>
                          <td>{row.signatureValid == null ? '—' : row.signatureValid ? 'معتبر' : 'نامعتبر'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'docs' && (
          <div className="card int-panel">
            <div className="int-section-head">
              <h3>لینک‌ها و مستندات API</h3>
              <p className="muted">مسیرها برای خوانایی چپ‌چین (LTR) نمایش داده می‌شوند.</p>
            </div>
            {docs ? (
              <>
                <div className="int-table-wrap">
                  <table className="admin-table int-docs-table">
                    <thead><tr><th>Method</th><th>Path</th><th>توضیح</th></tr></thead>
                    <tbody>
                      {docs.endpoints.map((e) => {
                        const full = docsEndpointUrl(e.path);
                        return (
                          <tr key={e.path + e.method}>
                            <td><span className={`int-method int-method-${e.method.toLowerCase()}`}>{e.method}</span></td>
                            <td>
                              <LtrLink href={full}>
                                <code dir="ltr">{full}</code>
                              </LtrLink>
                            </td>
                            <td>{e.desc}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {docs.authNotes.length > 0 && (
                  <ul className="int-notes">
                    {docs.authNotes.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <QueryState loading skeleton={<SkeletonList rows={4} />} loadingLabel="در حال بارگذاری مستندات…">
                {null}
              </QueryState>
            )}
          </div>
        )}
      </PermissionGate>
    </AppShell>
  );
}
