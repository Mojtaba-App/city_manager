'use client';

import { useEffect, useState } from 'react';
import {
  ConsentPurpose,
  CONSENT_PURPOSE_LABELS,
  CONSENT_STATUS_LABELS,
  ConsentStatus,
} from '@city-manager/shared';
import {
  createConsent,
  createPortalInvite,
  fetchConsents,
  fetchPortalInvites,
  grantConsent,
  revokeConsent,
  revokePortalInvite,
} from '@/lib/collaboration-api';
import { useFeedback } from '@/components/ui/Feedback';

function portalLandingUrl() {
  if (typeof window === 'undefined') return '/portal';
  return `${window.location.origin}/portal`;
}

export function HouseholdCollaborationPanel({
  householdId,
  canWrite,
}: {
  householdId: string;
  canWrite: boolean;
}) {
  const feedback = useFeedback();
  const [consents, setConsents] = useState<Array<Record<string, unknown>>>([]);
  const [invites, setInvites] = useState<Array<Record<string, unknown>>>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [consentForm, setConsentForm] = useState({
    purpose: ConsentPurpose.AGENCY_REFERRAL,
    scopes: ['case_summary', 'member_count'] as string[],
    grantNow: true,
  });

  async function load() {
    const [c, i] = await Promise.all([
      fetchConsents(householdId),
      fetchPortalInvites(householdId),
    ]);
    if (c.success && c.data) setConsents(c.data);
    if (i.success && i.data) setInvites(i.data);
  }

  useEffect(() => { void load(); }, [householdId]);

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      feedback.success(`${label} کپی شد`);
    } catch {
      feedback.error('کپی در کلیپ‌بورد ناموفق بود');
    }
  }

  async function addConsent() {
    const res = await createConsent({
      householdId,
      purpose: consentForm.purpose,
      scopeFields: consentForm.scopes,
      grantNow: consentForm.grantNow,
    });
    if (!res.success) {
      feedback.error(res.error?.message ?? 'ثبت رضایت ناموفق');
      return;
    }
    feedback.success('رضایت ثبت شد');
    void load();
  }

  async function createInvite() {
    const res = await createPortalInvite({ householdId });
    if (!res.success || !res.data) {
      feedback.error(res.error?.message ?? 'ایجاد دعوت ناموفق');
      return;
    }
    setInviteCode(res.data.inviteCode);
    feedback.success('کد دعوت ایجاد شد — آن را به شهروند بدهید');
    void load();
  }

  return (
    <div className="collab-household">
      <section className="card">
        <h3>رضایت‌نامه‌ها</h3>
        {canWrite && (
          <div className="collab-inline-form">
            <select value={consentForm.purpose} onChange={(e) => setConsentForm({ ...consentForm, purpose: e.target.value as ConsentPurpose })}>
              {Object.values(ConsentPurpose).map((p) => (
                <option key={p} value={p}>{CONSENT_PURPOSE_LABELS[p]}</option>
              ))}
            </select>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void addConsent()}>ثبت رضایت</button>
          </div>
        )}
        {consents.length === 0 ? <p className="muted">رضایتی ثبت نشده</p> : (
          <ul className="ops-list">
            {consents.map((c) => (
              <li key={String(c.id)} className="ops-list-item">
                <div>
                  <strong>{CONSENT_PURPOSE_LABELS[c.purpose as ConsentPurpose] ?? String(c.purpose)}</strong>
                  <small>{CONSENT_STATUS_LABELS[c.status as ConsentStatus] ?? String(c.status)}</small>
                </div>
                <div className="ops-list-actions">
                  {canWrite && c.status === 'pending' && (
                    <button type="button" className="btn btn-sm" onClick={() => void grantConsent(String(c.id)).then(() => load())}>اعطا</button>
                  )}
                  {canWrite && c.status === 'granted' && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void revokeConsent(String(c.id)).then((res) => {
                        if (!res.success) feedback.error(res.error?.message ?? 'لغو رضایت ناموفق');
                        else {
                          feedback.success('رضایت لغو شد');
                          void load();
                        }
                      })}
                    >
                      لغو
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3>دعوت پورتال شهروند</h3>
        <p className="muted">لینک ورود شهروند: <code dir="ltr">{portalLandingUrl()}</code></p>
        <div className="collab-inline-form">
          <button type="button" className="btn btn-sm" onClick={() => void copyText('لینک پورتال', portalLandingUrl())}>
            کپی لینک /portal
          </button>
          {canWrite && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void createInvite()}>ایجاد کد دعوت</button>
          )}
        </div>
        {inviteCode && (
          <div className="portal-code-display">
            <p>کد: <strong dir="ltr">{inviteCode}</strong></p>
            <button type="button" className="btn btn-sm" onClick={() => void copyText('کد دعوت', inviteCode)}>کپی کد</button>
          </div>
        )}
        {invites.length > 0 && (
          <ul className="ops-list">
            {invites.map((i) => (
              <li key={String(i.id)} className="ops-list-item">
                <div>
                  <span dir="ltr">…{String(i.inviteCodeHint)}</span>
                  <small>{String(i.status)}</small>
                </div>
                {canWrite && i.status !== 'revoked' && i.status !== 'expired' && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void revokePortalInvite(String(i.id)).then((res) => {
                      if (!res.success) feedback.error(res.error?.message ?? 'لغو دعوت ناموفق');
                      else {
                        feedback.success('دعوت لغو شد');
                        void load();
                      }
                    })}
                  >
                    لغو دعوت
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
