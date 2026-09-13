'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { EmptyState, PageHeader, PermissionGate } from '@/components/admin/AdminUi';
import { useAuth } from '@/lib/auth';
import {
  attachReferralConsent,
  createConsent,
  createReferral,
  fetchConsents,
  fetchReferrals,
  sendReferral,
  updateReferralStatus,
} from '@/lib/collaboration-api';
import { apiFetch } from '@/lib/api';
import {
  ConsentPurpose,
  ConsentStatus,
  DEFAULT_REFERRAL_SCOPES,
  REFERRAL_DATA_SCOPE_LABELS,
  REFERRAL_DESTINATION_KIND_LABELS,
  REFERRAL_STATUS_LABELS,
  ReferralDataScope,
  ReferralDestinationKind,
  ReferralStatus,
  consentCoversScopes,
  formatReferralDestinationLabel,
  listMunicipalReferralDestinations,
  missingConsentScopes,
} from '@city-manager/shared';
import { formatDateTime } from '@/lib/format';
import { useFeedback } from '@/components/ui/Feedback';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

const SCOPE_HINTS: Record<ReferralDataScope, string> = {
  case_summary: 'شماره پرونده و وضعیت — بدون نام یا کد ملی',
  member_count: 'فقط تعداد اعضا، بدون مشخصات فردی',
  vulnerability: 'امتیاز کلی آسیب‌پذیری — بدون جزئیات خانوار',
  address_district: 'محله یا منطقه — بدون آدرس دقیق ملک',
  contact_phone: 'فقط وجود کانال تماس — شماره کامل ارسال نمی‌شود',
  support_history: 'خلاصه بسته‌های حمایتی قبلی',
};

const MUNICIPAL_DESTINATIONS = listMunicipalReferralDestinations();

function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className="referrals-section-hint muted">{children}</p>;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <span className="settings-field-hint">{children}</span>;
}

function statusTone(status: string): string {
  if (status === ReferralStatus.ACCEPTED || status === ReferralStatus.SENT) return 'ok';
  if (status === ReferralStatus.REJECTED || status === ReferralStatus.CANCELLED) return 'off';
  if (status === ReferralStatus.PENDING_CONSENT) return 'info';
  if (status === ReferralStatus.READY) return 'ok';
  return 'info';
}

type ConsentRow = {
  id: string;
  status: string;
  purpose: string;
  scopeFields: string[];
  grantedByName?: string;
  grantedAt?: string;
};

export default function ReferralsPage() {
  const { hasPermission } = useAuth();
  const feedback = useFeedback();
  const canWrite = hasPermission('referrals:write');
  const canConsent = hasPermission('consents:write');
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [agencies, setAgencies] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    householdId: '',
    destinationKind: ReferralDestinationKind.PARTNER_AGENCY as string,
    agencyId: '',
    municipalDistrict: '',
    title: '',
    notes: '',
    scopes: [...DEFAULT_REFERRAL_SCOPES] as string[],
    consentId: '',
    createConsent: true,
    grantedByName: '',
  });
  const { loading, error, setError, run } = useQueryLoad();

  const grantedConsents = useMemo(
    () => consents.filter((c) => c.status === ConsentStatus.GRANTED),
    [consents],
  );

  const coveringConsents = useMemo(
    () => grantedConsents.filter((c) => consentCoversScopes(c.scopeFields, form.scopes)),
    [grantedConsents, form.scopes],
  );

  async function load() {
    await run(async () => {
      const res = await fetchReferrals();
      if (res.success && res.data) setItems(res.data);
      else if (!res.success) setError(res.error?.message ?? 'بارگذاری ارجاع‌ها ناموفق بود');
    });
  }

  useEffect(() => {
    void load();
    void apiFetch<Array<Record<string, unknown>>>('/case/agencies', {}).then((r) => {
      if (r.success && r.data) {
        setAgencies(r.data.map((a) => ({
          id: String(a.id),
          name: String(a.name),
          code: a.code != null ? String(a.code) : undefined,
        })));
      }
    });
  }, []);

  useEffect(() => {
    const hh = form.householdId.trim();
    if (!hh || hh.length < 32) {
      setConsents([]);
      return;
    }
    let cancelled = false;
    void fetchConsents(hh).then((r) => {
      if (cancelled || !r.success || !r.data) return;
      setConsents(r.data.map((c) => ({
        id: String(c.id),
        status: String(c.status),
        purpose: String(c.purpose ?? ''),
        scopeFields: Array.isArray(c.scopeFields) ? (c.scopeFields as string[]) : [],
        grantedByName: c.grantedByName ? String(c.grantedByName) : undefined,
        grantedAt: c.grantedAt ? String(c.grantedAt) : undefined,
      })));
    });
    return () => { cancelled = true; };
  }, [form.householdId]);

  useEffect(() => {
    if (form.consentId && !coveringConsents.some((c) => c.id === form.consentId)) {
      setForm((prev) => ({ ...prev, consentId: coveringConsents[0]?.id ?? '' }));
    } else if (!form.consentId && coveringConsents[0] && !form.createConsent) {
      setForm((prev) => ({ ...prev, consentId: coveringConsents[0].id }));
    }
  }, [coveringConsents, form.consentId, form.createConsent]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.householdId.trim() || !form.title.trim()) {
      feedback.error('شناسه پرونده و عنوان الزامی است');
      return;
    }
    if (form.destinationKind === ReferralDestinationKind.PARTNER_AGENCY && !form.agencyId) {
      feedback.error('ارگان همکار را انتخاب کنید');
      return;
    }
    if (form.destinationKind === ReferralDestinationKind.MUNICIPAL_DISTRICT && !form.municipalDistrict) {
      feedback.error('منطقه شهرداری را انتخاب کنید');
      return;
    }
    if (form.scopes.length === 0) {
      feedback.error('حداقل یک مورد از دامنه داده را انتخاب کنید');
      return;
    }
    if (!form.createConsent && !form.consentId) {
      feedback.error('رضایت معتبر را انتخاب کنید یا ثبت خودکار رضایت را فعال کنید');
      return;
    }

    setBusy(true);
    try {
      const res = await createReferral({
        householdId: form.householdId.trim(),
        destinationKind: form.destinationKind,
        agencyId: form.destinationKind === ReferralDestinationKind.PARTNER_AGENCY ? form.agencyId : undefined,
        municipalDistrict: form.destinationKind === ReferralDestinationKind.MUNICIPAL_DISTRICT
          ? Number(form.municipalDistrict)
          : undefined,
        title: form.title.trim(),
        notes: form.notes.trim() || undefined,
        scopeFields: form.scopes,
        consentId: form.createConsent ? undefined : (form.consentId || undefined),
        createConsent: form.createConsent,
        grantedByName: form.grantedByName.trim() || undefined,
      });
      if (!res.success) {
        feedback.error(res.error?.message ?? 'ثبت ناموفق');
        return;
      }
      feedback.success(form.createConsent ? 'ارجاع با رضایت ثبت شد و آماده ارسال است' : 'ارجاع ثبت شد');
      setForm({
        householdId: '',
        destinationKind: ReferralDestinationKind.PARTNER_AGENCY,
        agencyId: '',
        municipalDistrict: '',
        title: '',
        notes: '',
        scopes: [...DEFAULT_REFERRAL_SCOPES],
        consentId: '',
        createConsent: true,
        grantedByName: '',
      });
      setConsents([]);
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(id: string) {
    const ok = await feedback.confirm(
      'فقط داده‌های دامنه انتخاب‌شده پس از تأیید رضایت ارسال می‌شود. ادامه؟',
      'ارسال ارجاع حداقلی',
    );
    if (!ok) return;
    const res = await sendReferral(id);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ارسال ناموفق — رضایت یا دامنه را بررسی کنید');
      return;
    }
    feedback.success('ارجاع ارسال شد');
    void load();
  }

  async function handleAttachConsent(referralId: string, householdId: string, scopes: string[]) {
    const loaded = await fetchConsents(householdId);
    const rows = (loaded.success && loaded.data
      ? loaded.data.map((c) => ({
          id: String(c.id),
          status: String(c.status),
          scopeFields: Array.isArray(c.scopeFields) ? (c.scopeFields as string[]) : [],
        }))
      : []);
    let consentId = rows.find((c) =>
      c.status === ConsentStatus.GRANTED && consentCoversScopes(c.scopeFields, scopes),
    )?.id;

    if (!consentId && canConsent) {
      const created = await createConsent({
        householdId,
        purpose: ConsentPurpose.AGENCY_REFERRAL,
        scopeFields: scopes,
        grantNow: true,
        grantedByName: 'سرپرست خانوار',
      });
      if (!created.success || !created.data) {
        feedback.error(created.error?.message ?? 'ثبت رضایت ناموفق');
        return;
      }
      consentId = String((created.data as { id: string }).id);
    }
    if (!consentId) {
      feedback.error('رضایت پوشش‌دهنده دامنه یافت نشد');
      return;
    }
    const res = await attachReferralConsent(referralId, consentId);
    if (!res.success) {
      feedback.error(res.error?.message ?? 'اتصال رضایت ناموفق');
      return;
    }
    feedback.success('رضایت متصل شد — آماده ارسال');
    void load();
  }

  return (
    <AppShell title="ارجاع بین‌سازمانی">
      <PermissionGate allow={hasPermission('referrals:read')}>
        <PageHeader
          title="ارجاع با رضایت و محدودیت داده"
          description="ارسال حداقل داده به سازمان‌های همکار و مناطق شهرداری پس از ثبت رضایت"
        />

        <section className="card referrals-intro">
          <SectionHint>
            <strong>اصل حداقل‌سازی:</strong> فقط فیلدهای دامنه داده ارسال می‌شود.
            مقصد می‌تواند <strong>ارگان همکار</strong> یا <strong>منطقه شهرداری (۱–۸)</strong> باشد؛
            پس از تعریف دسترسی، همان مقصدها ارجاع را می‌بینند، پیگیری و اقدام می‌کنند.
          </SectionHint>
          <ol className="referrals-flow-steps muted">
            <li>انتخاب مقصد (ارگان یا منطقه)</li>
            <li>تعیین دامنه داده و ثبت/اتصال رضایت</li>
            <li>ارسال بسته حداقلی و پیگیری وضعیت</li>
          </ol>
        </section>

        <div className={`referrals-workspace ${canWrite ? '' : 'referrals-workspace--single'}`}>
          {canWrite && (
            <section className="card referrals-form-card">
              <div className="card-head">
                <div>
                  <h3>ارجاع جدید</h3>
                  <SectionHint>
                    شناسه پرونده همان <strong>UUID</strong> خانوار است — از جزئیات پرونده قابل کپی است.
                  </SectionHint>
                </div>
              </div>

              <form className="sec-form-rows" onSubmit={(e) => void handleCreate(e)}>
                <label className="settings-field sec-form-row">
                  <span className="settings-field-label">شناسه پرونده *</span>
                  <input
                    className="input-ltr"
                    placeholder="00000000-0000-0000-0000-000000000000"
                    value={form.householdId}
                    onChange={(e) => setForm({ ...form, householdId: e.target.value, consentId: '' })}
                    required
                  />
                  <FieldHint>با وارد کردن UUID، رضایت‌های اعطاشده این پرونده بارگذاری می‌شود</FieldHint>
                </label>

                <fieldset className="referrals-dest-fieldset">
                  <legend>مقصد ارجاع *</legend>
                  <div className="referrals-dest-kinds">
                    {(Object.values(ReferralDestinationKind) as ReferralDestinationKind[]).map((kind) => (
                      <label key={kind} className={`referrals-dest-kind${form.destinationKind === kind ? ' is-active' : ''}`}>
                        <input
                          type="radio"
                          name="destinationKind"
                          checked={form.destinationKind === kind}
                          onChange={() => setForm({
                            ...form,
                            destinationKind: kind,
                            agencyId: '',
                            municipalDistrict: '',
                          })}
                        />
                        <span>
                          <strong>{REFERRAL_DESTINATION_KIND_LABELS[kind]}</strong>
                          <small>
                            {kind === ReferralDestinationKind.PARTNER_AGENCY
                              ? 'سازمان‌های همکار ثبت‌شده در کاتالوگ ارگان‌ها'
                              : 'مناطق زیرمجموعه شهرداری برای پیگیری محلی'}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>

                  {form.destinationKind === ReferralDestinationKind.PARTNER_AGENCY ? (
                    <label className="settings-field sec-form-row">
                      <span className="settings-field-label">سازمان / ارگان همکار *</span>
                      <select
                        value={form.agencyId}
                        onChange={(e) => setForm({ ...form, agencyId: e.target.value })}
                        required
                      >
                        <option value="">انتخاب ارگان…</option>
                        {agencies.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}{a.code ? ` (${a.code})` : ''}</option>
                        ))}
                      </select>
                      <FieldHint>در آینده با تعریف دسترسی، همان ارگان inbox ارجاع را خواهد داشت</FieldHint>
                    </label>
                  ) : (
                    <label className="settings-field sec-form-row">
                      <span className="settings-field-label">منطقه شهرداری *</span>
                      <select
                        value={form.municipalDistrict}
                        onChange={(e) => setForm({ ...form, municipalDistrict: e.target.value })}
                        required
                      >
                        <option value="">انتخاب منطقه…</option>
                        {MUNICIPAL_DESTINATIONS.map((d) => (
                          <option key={d.code} value={d.municipalDistrict}>{d.label}</option>
                        ))}
                      </select>
                      <FieldHint>
                        {MUNICIPAL_DESTINATIONS.find((d) => String(d.municipalDistrict) === form.municipalDistrict)?.description
                          ?? 'واحد منطقه برای اقدام و پیگیری محلی'}
                      </FieldHint>
                    </label>
                  )}
                </fieldset>

                <label className="settings-field sec-form-row">
                  <span className="settings-field-label">عنوان ارجاع *</span>
                  <input
                    placeholder="مثلاً ارجاع حمایت مسکن به منطقه ۳"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </label>

                <label className="settings-field sec-form-row">
                  <span className="settings-field-label">یادداشت داخلی</span>
                  <textarea
                    rows={2}
                    placeholder="توضیح داخلی — در بسته ارسالی نیست مگر دامنه داده اجازه دهد"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>

                <div className="referrals-scope-panel">
                  <h4 className="referrals-subtitle">دامنه داده (حداقل لازم)</h4>
                  <SectionHint>
                    فقط موارد ضروری را علامت بزنید. رضایت باید همین دامنه را پوشش دهد.
                  </SectionHint>
                  <div className="referrals-scope-grid">
                    {(Object.keys(REFERRAL_DATA_SCOPE_LABELS) as ReferralDataScope[]).map((s) => (
                      <label key={s} className="referrals-scope-option">
                        <input
                          type="checkbox"
                          checked={form.scopes.includes(s)}
                          onChange={(e) => setForm({
                            ...form,
                            scopes: e.target.checked
                              ? [...form.scopes, s]
                              : form.scopes.filter((x) => x !== s),
                          })}
                        />
                        <span className="referrals-scope-copy">
                          <strong>{REFERRAL_DATA_SCOPE_LABELS[s]}</strong>
                          <small>{SCOPE_HINTS[s]}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="referrals-consent-panel">
                  <h4 className="referrals-subtitle">رضایت</h4>
                  <label className="referrals-scope-option">
                    <input
                      type="checkbox"
                      checked={form.createConsent}
                      onChange={(e) => setForm({
                        ...form,
                        createConsent: e.target.checked,
                        consentId: e.target.checked ? '' : (coveringConsents[0]?.id ?? ''),
                      })}
                    />
                    <span className="referrals-scope-copy">
                      <strong>ثبت و اعطای رضایت هم‌زمان با ارجاع</strong>
                      <small>رضایت با دامنه انتخاب‌شده ساخته و اعطا می‌شود (پیشنهادی برای اجرا)</small>
                    </span>
                  </label>

                  {!form.createConsent && (
                    <label className="settings-field sec-form-row">
                      <span className="settings-field-label">رضایت اعطاشده *</span>
                      <select
                        value={form.consentId}
                        onChange={(e) => setForm({ ...form, consentId: e.target.value })}
                        required={!form.createConsent}
                      >
                        <option value="">انتخاب رضایت…</option>
                        {coveringConsents.map((c) => (
                          <option key={c.id} value={c.id}>
                            {(c.grantedByName || 'رضایت')} — {c.scopeFields.length} دامنه
                            {c.grantedAt ? ` · ${formatDateTime(c.grantedAt)}` : ''}
                          </option>
                        ))}
                      </select>
                      {form.householdId && coveringConsents.length === 0 && (
                        <FieldHint>
                          رضایت پوشش‌دهنده این دامنه نیست
                          {grantedConsents[0]
                            ? ` (کمبود: ${missingConsentScopes(grantedConsents[0].scopeFields, form.scopes).map((s) => REFERRAL_DATA_SCOPE_LABELS[s as ReferralDataScope] ?? s).join('، ')})`
                            : ' — ابتدا رضایت اعطا کنید یا گزینه ثبت خودکار را بزنید'}
                        </FieldHint>
                      )}
                    </label>
                  )}

                  {form.createConsent && (
                    <label className="settings-field sec-form-row">
                      <span className="settings-field-label">نام اعطاکننده رضایت</span>
                      <input
                        placeholder="سرپرست خانوار"
                        value={form.grantedByName}
                        onChange={(e) => setForm({ ...form, grantedByName: e.target.value })}
                      />
                    </label>
                  )}
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? 'در حال ثبت…' : 'ثبت ارجاع'}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="card referrals-list-card">
            <div className="card-head">
              <div>
                <h3>فهرست ارجاع‌ها</h3>
                <SectionHint>
                  «آماده ارسال» یعنی رضایت متصل است؛ پس از ارسال، مقصد می‌تواند (با دسترسی آینده) پیگیری کند.
                </SectionHint>
              </div>
            </div>

            <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={5} />} loadingLabel="در حال بارگذاری ارجاع‌ها…">
              {items.length === 0 ? (
                <EmptyState
                  title="ارجاعی ثبت نشده"
                  description={canWrite ? 'فرم کنار را برای ارجاع به ارگان یا منطقه شهرداری پر کنید.' : undefined}
                />
              ) : (
                <ul className="referrals-list">
                  {items.map((r) => {
                    const status = String(r.status);
                    const scopes = Array.isArray(r.scopeFields) ? (r.scopeFields as string[]) : [];
                    const dest = formatReferralDestinationLabel({
                      destinationKind: r.destinationKind != null ? String(r.destinationKind) : null,
                      destinationLabel: r.destinationLabel != null ? String(r.destinationLabel) : null,
                      municipalDistrict: r.municipalDistrict != null ? Number(r.municipalDistrict) : null,
                      agencyName: agencies.find((a) => a.id === String(r.agencyId))?.name,
                    });
                    const kindLabel = REFERRAL_DESTINATION_KIND_LABELS[
                      String(r.destinationKind) as ReferralDestinationKind
                    ] ?? 'مقصد';
                    return (
                      <li key={String(r.id)} className="referrals-list-item">
                        <div className="referrals-list-main">
                          <div className="referrals-list-head">
                            <strong>{String(r.title)}</strong>
                            <span className={`status-pill ${statusTone(status)}`}>
                              {REFERRAL_STATUS_LABELS[status as ReferralStatus] ?? status}
                            </span>
                          </div>
                          <small className="referrals-list-meta muted">
                            {kindLabel}: {dest}
                            {' · '}
                            {formatDateTime(String(r.createdAt))}
                            {r.accessEnabled ? ' · آماده inbox مقصد' : ''}
                          </small>
                          {scopes.length > 0 && (
                            <div className="referrals-scope-chips">
                              {scopes.map((s) => (
                                <span key={s} className="referrals-scope-chip">
                                  {REFERRAL_DATA_SCOPE_LABELS[s as ReferralDataScope] ?? s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {canWrite && (
                          <div className="referrals-list-actions">
                            {status === ReferralStatus.PENDING_CONSENT && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => void handleAttachConsent(
                                  String(r.id),
                                  String(r.householdId),
                                  scopes,
                                )}
                              >
                                اتصال رضایت
                              </button>
                            )}
                            {[ReferralStatus.READY, ReferralStatus.DRAFT, ReferralStatus.PENDING_CONSENT].includes(status as ReferralStatus) && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => void handleSend(String(r.id))}
                              >
                                ارسال
                              </button>
                            )}
                            {status === ReferralStatus.SENT && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => void updateReferralStatus(String(r.id), ReferralStatus.ACCEPTED).then(() => load())}
                                >
                                  پذیرش
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => void updateReferralStatus(String(r.id), ReferralStatus.REJECTED).then(() => load())}
                                >
                                  رد
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </QueryState>
          </section>
        </div>
      </PermissionGate>
    </AppShell>
  );
}
