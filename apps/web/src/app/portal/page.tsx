'use client';

import { useEffect, useState } from 'react';
import {
  downloadPortalDocument,
  fetchPortalConsents,
  fetchPortalDocuments,
  fetchPortalSummary,
  grantPortalConsent,
  redeemPortalInvite,
  revokePortalConsent,
  uploadPortalDocument,
} from '@/lib/collaboration-api';
import { fetchPublicBranding } from '@/lib/admin-api';
import {
  CONSENT_STATUS_LABELS,
  ConsentStatus,
  HOUSEHOLD_STATUS_LABELS,
  HouseholdStatus,
  PortalHouseholdSummary,
} from '@city-manager/shared';
import { formatNumber } from '@/lib/format';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { EmptyState } from '@/components/admin/AdminUi';
import { NavIcon } from '@/components/NavIcons';

type PortalTab = 'summary' | 'docs' | 'consents';

function statusLabel(status: string) {
  return HOUSEHOLD_STATUS_LABELS[status as HouseholdStatus] ?? status;
}

export default function PortalPage() {
  const [mode, setMode] = useState<'login' | 'home'>('login');
  const [code, setCode] = useState('');
  const [summary, setSummary] = useState<PortalHouseholdSummary | null>(null);
  const [docs, setDocs] = useState<Array<Record<string, unknown>>>([]);
  const [consents, setConsents] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<PortalTab>('summary');
  const [title, setTitle] = useState('پورتال شهروند');
  const [subtitle, setSubtitle] = useState('کد دعوت ارسال‌شده توسط مددکار را وارد کنید');

  useEffect(() => {
    fetchPublicBranding().then((res) => {
      if (!res.success || !res.data) return;
      const b = res.data;
      if (b.title) setTitle(`${b.title} — پورتال شهروند`);
    }).catch(() => undefined);
    const t = localStorage.getItem('portalAccessToken');
    if (t) {
      setMode('home');
      void loadHome();
    }
  }, []);

  async function loadHome() {
    setLoading(true);
    setError('');
    const [s, d, c] = await Promise.all([
      fetchPortalSummary(),
      fetchPortalDocuments(),
      fetchPortalConsents(),
    ]);
    setLoading(false);
    if (s.success && s.data) setSummary(s.data);
    else if (!s.success) setError(s.error?.message ?? 'بارگذاری پرونده ناموفق بود');
    if (d.success && d.data) setDocs(d.data);
    if (c.success && c.data) setConsents(c.data);
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await redeemPortalInvite(code.trim());
    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error?.message ?? 'کد نامعتبر است');
      return;
    }
    localStorage.setItem('portalAccessToken', res.data.accessToken);
    setSummary(res.data.summary);
    setMode('home');
    void loadHome();
  }

  function logout() {
    localStorage.removeItem('portalAccessToken');
    setMode('login');
    setSummary(null);
    setDocs([]);
    setConsents([]);
    setError('');
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadPortalDocument(file, file.name);
    if (!res.success) {
      setError(res.error?.message ?? 'بارگذاری ناموفق');
      return;
    }
    void loadHome();
  }

  if (mode === 'login') {
    return (
      <div className="portal-shell">
        <main className="portal-login card">
          <div className="portal-login-brand" aria-hidden>
            <NavIcon name="households" size={28} />
          </div>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          <form onSubmit={(e) => void handleRedeem(e)}>
            <label>
              <span>کد دعوت</span>
              <input
                id="portal-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXX-XXXX"
                autoComplete="off"
                required
              />
            </label>
            {error && <p className="portal-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'در حال ورود…' : 'ورود به پرونده'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  const pendingConsents = consents.filter((c) => c.status === 'pending').length;

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div>
          <p className="portal-kicker">پورتال پیگیری پرونده</p>
          <strong>{summary ? `پرونده ${summary.caseNumber}` : 'پرونده خانوار'}</strong>
        </div>
        <button type="button" className="btn btn-sm" onClick={logout}>خروج</button>
      </header>
      <main className="portal-home">
        <nav className="portal-tabs" aria-label="بخش‌های پورتال">
          <button type="button" className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>
            خلاصه
          </button>
          <button type="button" className={tab === 'docs' ? 'active' : ''} onClick={() => setTab('docs')}>
            مدارک ({formatNumber(docs.length)})
          </button>
          <button type="button" className={tab === 'consents' ? 'active' : ''} onClick={() => setTab('consents')}>
            رضایت‌ها{pendingConsents > 0 ? ` (${formatNumber(pendingConsents)})` : ''}
          </button>
        </nav>

        <QueryState loading={loading && !summary} error={error} skeleton={<SkeletonList rows={4} />} loadingLabel="در حال بارگذاری پورتال…">
          {tab === 'summary' && summary && (
            <section className="card">
              <h2>وضعیت پرونده</h2>
              <dl className="portal-summary">
                <div>
                  <dt>وضعیت</dt>
                  <dd><span className="status-pill info">{statusLabel(summary.status)}</span></dd>
                </div>
                <div>
                  <dt>اعضا</dt>
                  <dd>{formatNumber(summary.memberCount)}</dd>
                </div>
                {summary.neighborhoodName ? (
                  <div><dt>محله</dt><dd>{summary.neighborhoodName}</dd></div>
                ) : null}
                {summary.addressHint ? (
                  <div><dt>منطقه</dt><dd>{summary.addressHint}</dd></div>
                ) : null}
              </dl>
            </section>
          )}

          {tab === 'docs' && (
            <section className="card">
              <h3>مدارک پرونده</h3>
              <p className="muted">فقط مدارک مرتبط با همین پرونده را بارگذاری کنید (PDF یا تصویر).</p>
              <label className="portal-upload">
                <span>انتخاب فایل</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => void handleUpload(e)} />
              </label>
              {docs.length === 0 ? (
                <EmptyState title="مدرکی ثبت نشده" description="پس از بارگذاری، فهرست اینجا نمایش داده می‌شود." />
              ) : (
                <ul className="portal-doc-list">
                  {docs.map((d) => (
                    <li key={String(d.id)}>
                      <div>
                        <strong>{String(d.title)}</strong>
                        <small>{String(d.category ?? 'مدرک')}</small>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => void downloadPortalDocument(String(d.id), String(d.fileName ?? d.title)).then((res) => {
                          if (!res.success) setError(res.error?.message ?? 'دانلود ناموفق');
                        })}
                      >
                        دانلود
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === 'consents' && (
            <section className="card">
              <h3>رضایت‌های داده</h3>
              {consents.length === 0 ? (
                <EmptyState title="رضایتی ثبت نشده" />
              ) : (
                <ul className="portal-consent-list">
                  {consents.map((c) => (
                    <li key={String(c.id)}>
                      <div>
                        <strong>{String(c.purpose)}</strong>
                        <small>{CONSENT_STATUS_LABELS[c.status as ConsentStatus] ?? String(c.status)}</small>
                      </div>
                      {c.status === 'pending' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => void grantPortalConsent(String(c.id)).then(() => loadHome())}
                        >
                          تأیید رضایت
                        </button>
                      )}
                      {c.status === 'granted' && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => void revokePortalConsent(String(c.id)).then((res) => {
                            if (!res.success) setError(res.error?.message ?? 'لغو رضایت ناموفق');
                            else void loadHome();
                          })}
                        >
                          لغو رضایت
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </QueryState>
      </main>
    </div>
  );
}
