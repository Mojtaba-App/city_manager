'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { NavIcon } from '@/components/NavIcons';
import {
  fetchHousehold, fetchMembers, fetchInsurance, fetchHistory, updateHousehold, createMember,
  deleteHousehold, deleteMember,
} from '@/lib/case-api';
import {
  MemberRole,
  EnrichedChangeLogEntry,
  HouseholdDetailTab,
  HouseholdStatus,
  HOUSEHOLD_STATUS_LABELS,
  LAND_USE_LABELS,
  LandUseType,
  getAllowedHouseholdStatusTransitions,
  buildHouseholdSplitUrl,
  buildHouseholdUrl,
  buildMapCaseUrl,
  validateMemberPartial,
} from '@city-manager/shared';
import { formatNumber, toPersianDigits } from '@/lib/format';
import { HouseholdOperationsPanel } from '@/components/case/HouseholdOperationsPanel';
import { HouseholdCollaborationPanel } from '@/components/case/HouseholdCollaborationPanel';
import { EnrichedHistoryList } from '@/components/case/EnrichedHistoryList';
import { TrajectoryCompareSummary } from '@/components/case/TrajectoryCompareSummary';
import { DwellingMiniMap } from '@/components/case/DwellingMiniMap';
import { HouseholdSummaryBar, HOUSEHOLD_TAB_LABELS } from '@/components/case/HouseholdSummaryBar';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useFeedback } from '@/components/ui/Feedback';
import { useAuth } from '@/lib/auth';
import { useUxPersona } from '@/lib/use-ux-persona';
import { pushRecentHousehold } from '@/lib/recent-items';

const STATUS_LABELS = HOUSEHOLD_STATUS_LABELS as Record<string, string>;

export type HouseholdPanelVariant = 'page' | 'drawer' | 'split';
export type HouseholdUrlSync = 'page' | 'map' | 'list' | false;

export interface HouseholdDetailPanelProps {
  householdId: string;
  variant?: HouseholdPanelVariant;
  initialTab?: HouseholdDetailTab;
  urlSync?: HouseholdUrlSync;
  dwellingId?: string;
  onClose?: () => void;
  onDeleted?: () => void;
}

export function HouseholdDetailPanel({
  householdId,
  variant = 'page',
  initialTab,
  urlSync = 'page',
  dwellingId,
  onClose,
  onDeleted,
}: HouseholdDetailPanelProps) {
  const feedback = useFeedback();
  const { hasPermission } = useAuth();
  const canWriteHousehold = hasPermission('households:write');
  const canWriteMembers = hasPermission('members:write');
  const { householdTabs, defaultHouseholdTab } = useUxPersona();
  const router = useRouter();

  const resolvedInitial = initialTab && householdTabs.includes(initialTab)
    ? initialTab
    : defaultHouseholdTab;

  const [tab, setTabState] = useState<HouseholdDetailTab>(resolvedInitial);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [members, setMembers] = useState<unknown[]>([]);
  const [insurance, setInsurance] = useState<unknown[]>([]);
  const [history, setHistory] = useState<EnrichedChangeLogEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [newMember, setNewMember] = useState({
    firstName: '',
    lastName: '',
    nationalId: '',
    phone: '',
    memberRole: MemberRole.CHILD,
  });
  const [memberErrors, setMemberErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [nextStatus, setNextStatus] = useState('');

  const syncTabUrl = useCallback((next: HouseholdDetailTab) => {
    if (!urlSync) return;
    if (urlSync === 'page') {
      const qs = next === defaultHouseholdTab ? '' : `?tab=${next}`;
      router.replace(`/dashboard/households/${householdId}${qs}`, { scroll: false });
      return;
    }
    if (urlSync === 'list') {
      router.replace(buildHouseholdSplitUrl(householdId, next), { scroll: false });
      return;
    }
    if (urlSync === 'map') {
      router.replace(buildMapCaseUrl({ householdId, dwellingId, tab: next }), { scroll: false });
    }
  }, [urlSync, router, householdId, dwellingId, defaultHouseholdTab]);

  const setTab = useCallback((next: HouseholdDetailTab) => {
    setTabState(next);
    syncTabUrl(next);
  }, [syncTabUrl]);

  useEffect(() => {
    if (initialTab && householdTabs.includes(initialTab)) {
      setTabState(initialTab);
    }
  }, [initialTab, householdTabs]);

  useEffect(() => {
    void load();
  }, [householdId]);

  async function load() {
    setPageLoading(true);
    setLoadError(null);
    const res = await fetchHousehold(householdId);
    if (res.success) {
      const payload = res.data as Record<string, unknown>;
      setData(payload);
      const hh = payload.household as Record<string, unknown> | undefined;
      if (hh?.caseNumber) {
        pushRecentHousehold({
          id: householdId,
          caseNumber: String(hh.caseNumber),
          label: `پرونده ${hh.caseNumber}`,
        });
      }
      const allowed = getAllowedHouseholdStatusTransitions(String(hh?.status ?? ''));
      setNextStatus(allowed[0] ?? '');
    } else setLoadError(res.error?.message ?? 'بارگذاری پرونده ناموفق بود');
    const m = await fetchMembers(householdId);
    if (m.success) setMembers(m.data as unknown[]);
    const ins = await fetchInsurance(householdId);
    if (ins.success) setInsurance(ins.data as unknown[]);
    const h = await fetchHistory(householdId);
    if (h.success) setHistory((h.data ?? []) as EnrichedChangeLogEntry[]);
    setPageLoading(false);
  }

  async function addMember() {
    if (!canWriteMembers) return;
    const errs = validateMemberPartial({
      firstName: newMember.firstName,
      lastName: newMember.lastName,
      nationalId: newMember.nationalId,
      phone: newMember.phone,
    });
    setMemberErrors(errs);
    if (Object.keys(errs).length) {
      feedback.error('اطلاعات عضو را بررسی کنید', 'افزودن عضو');
      return;
    }
    setBusy(true);
    const res = await createMember(householdId, {
      firstName: newMember.firstName.trim(),
      lastName: newMember.lastName.trim(),
      nationalId: newMember.nationalId.trim() || undefined,
      phone: newMember.phone.trim() || undefined,
      memberRole: newMember.memberRole,
    });
    setBusy(false);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'ثبت عضو ناموفق بود', 'افزودن عضو');
      return;
    }
    setNewMember({ firstName: '', lastName: '', nationalId: '', phone: '', memberRole: MemberRole.CHILD });
    setMemberErrors({});
    feedback.success('عضو افزوده شد');
    void load();
  }

  async function changeStatus() {
    const current = String((data?.household as Record<string, unknown> | undefined)?.status ?? '');
    const allowed = getAllowedHouseholdStatusTransitions(current);
    const target = allowed.includes(nextStatus as HouseholdStatus) ? nextStatus : allowed[0];
    if (!target) {
      await feedback.alert('این پرونده در وضعیت پایانی است و انتقال مجاز ندارد.', 'وضعیت');
      return;
    }
    const reason = await feedback.prompt('علت تغییر وضعیت را بنویسید', {
      title: 'تغییر وضعیت پرونده',
    });
    if (!reason?.trim()) return;
    setBusy(true);
    const res = await updateHousehold(householdId, { status: target, statusChangeReason: reason.trim() });
    setBusy(false);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'تغییر وضعیت ناموفق بود', 'وضعیت');
      return;
    }
    feedback.success('وضعیت پرونده به‌روز شد');
    void load();
  }

  async function handleDelete() {
    const caseNumber = String((data?.household as Record<string, unknown> | undefined)?.caseNumber ?? '');
    const ok = await feedback.confirm(
      `پرونده «${caseNumber}» حذف شود؟`,
      'حذف پرونده خانوار',
    );
    if (!ok) return;
    setBusy(true);
    const res = await deleteHousehold(householdId);
    setBusy(false);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'حذف ناموفق بود', 'حذف پرونده');
      return;
    }
    feedback.success('پرونده حذف شد');
    if (onDeleted) onDeleted();
    else router.push('/dashboard/households');
  }

  async function handleDeleteMember(memberId: string, label: string) {
    const ok = await feedback.confirm(
      `عضو «${label}» حذف شود؟ (سرپرست فقط در صورت تنها بودن قابل حذف است)`,
      'حذف عضو',
    );
    if (!ok) return;
    setBusy(true);
    const res = await deleteMember(householdId, memberId);
    setBusy(false);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'حذف عضو ناموفق بود', 'حذف عضو');
      return;
    }
    feedback.success('عضو حذف شد');
    void load();
  }

  const household = data?.household as Record<string, unknown> | undefined;
  const dwelling = data?.dwelling as Record<string, unknown> | undefined;
  const status = String(household?.status ?? '');
  const allowedNext = getAllowedHouseholdStatusTransitions(status);
  const compact = variant !== 'page';
  const fullPageHref = buildHouseholdUrl(householdId, tab);

  return (
    <QueryState
      loading={pageLoading && !data}
      error={loadError}
      skeleton={<SkeletonCard />}
      loadingLabel="در حال بارگذاری پرونده…"
    >
      <div className={`hh-detail ${compact ? 'hh-detail--compact' : ''}`}>
        <header className={`hh-detail-hero ${compact ? 'hh-detail-hero--compact' : ''}`}>
          <div>
            {!compact ? (
              <Link href="/dashboard/households" className="hh-back">
                ← بازگشت به فهرست
              </Link>
            ) : onClose ? (
              <button type="button" className="hh-back btn-link" onClick={onClose}>
                ← بستن
              </button>
            ) : null}
            <h2>پرونده {toPersianDigits(String(household?.caseNumber ?? '…'))}</h2>
            <div className="hh-detail-tags">
              <span className={`hh-status hh-status-${status}`}>
                {STATUS_LABELS[status] ?? (status || '—')}
              </span>
              <span className="muted">{formatNumber(Number(household?.memberCount ?? members.length))} عضو</span>
            </div>
          </div>
          <div className="hh-detail-actions">
            {compact && (
              <Link href={fullPageHref} className="btn btn-sm" title="باز کردن صفحه کامل">
                صفحه کامل
              </Link>
            )}
            <Link href={`/dashboard/households/${householdId}/trajectory`} className="btn btn-primary btn-sm">
              <NavIcon name="trajectory" size={16} />
              خط سیر
            </Link>
            {!compact && canWriteHousehold && (
              <>
                {allowedNext.length > 0 ? (
                  <select
                    className="btn"
                    value={allowedNext.includes(nextStatus as HouseholdStatus) ? nextStatus : allowedNext[0]}
                    disabled={busy}
                    onChange={(e) => setNextStatus(e.target.value)}
                    aria-label="وضعیت بعدی"
                  >
                    {allowedNext.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  className="btn"
                  disabled={busy || allowedNext.length === 0}
                  onClick={() => void changeStatus()}
                >
                  تغییر وضعیت
                </button>
                <button type="button" className="btn hh-delete-btn" disabled={busy} onClick={() => void handleDelete()}>
                  حذف پرونده
                </button>
              </>
            )}
          </div>
        </header>

        {household && (
          <HouseholdSummaryBar
            householdId={householdId}
            household={household}
            dwelling={dwelling}
            memberCount={Number(household?.memberCount ?? members.length)}
            onTabChange={setTab}
          />
        )}

        <div className="case-tabs hh-tabs" role="tablist" aria-label="بخش‌های پرونده">
          {householdTabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? 'active' : ''}
              onClick={() => setTab(t)}
            >
              {HOUSEHOLD_TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <>
            <div className="card hh-info-grid">
              <div><span>وضعیت</span><strong>{STATUS_LABELS[status] ?? status}</strong></div>
              <div><span>تعداد اعضا</span><strong>{formatNumber(Number(household?.memberCount ?? members.length))}</strong></div>
              <div className="hh-info-wide"><span>آدرس</span><strong>{String(dwelling?.fullAddress ?? '—')}</strong></div>
              <div><span>مساحت</span><strong>{dwelling?.areaSqm ? `${formatNumber(Number(dwelling.areaSqm))} m²` : '—'}</strong></div>
              <div>
                <span>کاربری زمین</span>
                <strong>
                  {dwelling?.landUse
                    ? (LAND_USE_LABELS[dwelling.landUse as LandUseType] ?? String(dwelling.landUse))
                    : '—'}
                </strong>
              </div>
              <div><span>قدمت ابنیه</span><strong>{dwelling?.buildingAgeYears != null ? `${formatNumber(Number(dwelling.buildingAgeYears))} سال` : '—'}</strong></div>
              <div className="hh-info-wide"><span>یادداشت</span><strong>{String(household?.notes ?? '—')}</strong></div>
            </div>
            {Boolean(dwelling?.id) && (
              <DwellingMiniMap
                dwellingId={String(dwelling?.id)}
                geometry={dwelling?.geometry}
                address={String(dwelling?.fullAddress ?? '')}
              />
            )}
            <TrajectoryCompareSummary householdId={householdId} />
          </>
        )}

        {tab === 'members' && (
          <div className="card">
            <table className="case-table">
              <thead>
                <tr><th>نام</th><th>نقش</th><th>سن</th><th>تحصیلات</th><th>شغل</th>{canWriteMembers ? <th></th> : null}</tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr><td colSpan={canWriteMembers ? 6 : 5} className="muted" style={{ textAlign: 'center' }}>عضوی ثبت نشده</td></tr>
                ) : members.map((m) => {
                  const row = m as Record<string, unknown>;
                  const label = `${String(row.firstName)} ${String(row.lastName)}`.trim();
                  return (
                    <tr key={String(row.id)}>
                      <td>{label}</td>
                      <td>{String(row.memberRole)}</td>
                      <td>{row.age != null ? formatNumber(Number(row.age)) : '—'}</td>
                      <td>{String(row.educationLevel ?? '—')}</td>
                      <td>{String(row.jobTitle ?? '—')}</td>
                      {canWriteMembers ? (
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busy}
                            onClick={() => void handleDeleteMember(String(row.id), label || String(row.id))}
                          >
                            حذف
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!compact && canWriteMembers && (
              <div className="hh-add-member">
                <h4>افزودن عضو</h4>
                <div className="form-grid">
                  <label className={`form-group ${memberErrors.firstName ? 'has-error' : ''}`}>
                    <span>نام <em className="req-star">*</em></span>
                    <input
                      placeholder="نام"
                      value={newMember.firstName}
                      aria-invalid={Boolean(memberErrors.firstName)}
                      onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })}
                    />
                    {memberErrors.firstName && <small className="field-error">{memberErrors.firstName}</small>}
                  </label>
                  <label className={`form-group ${memberErrors.lastName ? 'has-error' : ''}`}>
                    <span>نام خانوادگی <em className="req-star">*</em></span>
                    <input
                      placeholder="نام خانوادگی"
                      value={newMember.lastName}
                      aria-invalid={Boolean(memberErrors.lastName)}
                      onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })}
                    />
                    {memberErrors.lastName && <small className="field-error">{memberErrors.lastName}</small>}
                  </label>
                  <label className="form-group">
                    <span>نقش</span>
                    <select
                      value={newMember.memberRole}
                      onChange={(e) => setNewMember({ ...newMember, memberRole: e.target.value as MemberRole })}
                    >
                      <option value={MemberRole.CHILD}>فرزند</option>
                      <option value={MemberRole.SPOUSE}>همسر</option>
                      <option value={MemberRole.OTHER}>سایر</option>
                    </select>
                  </label>
                  <label className={`form-group ${memberErrors.nationalId ? 'has-error' : ''}`}>
                    <span>کد ملی</span>
                    <input
                      className="input-ltr"
                      placeholder="اختیاری"
                      value={newMember.nationalId}
                      aria-invalid={Boolean(memberErrors.nationalId)}
                      onChange={(e) => setNewMember({ ...newMember, nationalId: e.target.value })}
                    />
                    {memberErrors.nationalId && <small className="field-error">{memberErrors.nationalId}</small>}
                  </label>
                  <label className={`form-group ${memberErrors.phone ? 'has-error' : ''}`}>
                    <span>تلفن</span>
                    <input
                      className="input-ltr"
                      placeholder="اختیاری"
                      value={newMember.phone}
                      aria-invalid={Boolean(memberErrors.phone)}
                      onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                    />
                    {memberErrors.phone && <small className="field-error">{memberErrors.phone}</small>}
                  </label>
                </div>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void addMember()}>
                  افزودن عضو
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'insurance' && (
          <div className="card">
            {insurance.length === 0 ? <p className="muted">رکورد بیمه‌ای ثبت نشده</p> : (
              <ul className="hh-simple-list">
                {insurance.map((i) => {
                  const row = i as Record<string, unknown>;
                  return (
                    <li key={String(row.id)}>
                      <strong>{String(row.insuranceType)}</strong>
                      <span>{row.isActive ? 'فعال' : 'غیرفعال'}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {tab === 'operations' && (
          <HouseholdOperationsPanel
            householdId={householdId}
            caseNumber={String(household?.caseNumber ?? '')}
          />
        )}

        {tab === 'collaboration' && (
          <HouseholdCollaborationPanel
            householdId={householdId}
            canWrite={hasPermission('consents:write') || hasPermission('portal:manage')}
          />
        )}

        {tab === 'history' && (
          <div className="card">
            <EnrichedHistoryList entries={history} />
          </div>
        )}
      </div>
    </QueryState>
  );
}
