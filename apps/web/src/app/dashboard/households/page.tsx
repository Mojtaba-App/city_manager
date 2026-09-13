'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { NavIcon } from '@/components/NavIcons';
import { useFeedback } from '@/components/ui/Feedback';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { SplitView } from '@/components/ui/SplitView';
import { HouseholdDetailPanel } from '@/components/case/HouseholdDetailPanel';
import { SavedFiltersBar } from '@/components/filters/SavedFiltersBar';
import { deleteHousehold, fetchHouseholds } from '@/lib/case-api';
import { formatDate, formatNumber, toPersianDigits, normalizeDigitsForSearch } from '@/lib/format';
import {
  HouseholdDetailTab,
  HouseholdListFilter,
  HouseholdStatusFilter,
  HOUSEHOLD_STATUS_FILTER_LABELS,
  describeHouseholdListFilter,
  getCasePresentationMode,
  householdListFiltersEqual,
  isDefaultHouseholdListFilter,
} from '@city-manager/shared';
import { useUxPersona } from '@/lib/use-ux-persona';
import { useDashboardAccess } from '@/lib/use-dashboard-access';

interface HouseholdRow {
  id: string;
  caseNumber: string;
  status: string;
  memberCount: number;
  registeredAt: string;
  notes?: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'پیش‌نویس',
  active: 'فعال',
  suspended: 'معلق',
  graduated: 'فارغ‌شده',
  withdrawn: 'انصراف',
};

function HouseholdsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedback = useFeedback();
  const { persona, householdTabs, defaultHouseholdTab } = useUxPersona();
  const { canWrite } = useDashboardAccess('/dashboard/households');
  const presentation = getCasePresentationMode(persona, 'households_list');

  const selectedCaseId = searchParams.get('case');
  const tabParam = searchParams.get('tab') as HouseholdDetailTab | null;
  const selectedTab = tabParam && householdTabs.includes(tabParam) ? tabParam : defaultHouseholdTab;

  const initialStatus = (searchParams.get('status') as HouseholdStatusFilter | null) ?? 'all';
  const initialQuery = searchParams.get('q') ?? '';

  const [items, setItems] = useState<HouseholdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<HouseholdStatusFilter>(
    Object.prototype.hasOwnProperty.call(HOUSEHOLD_STATUS_FILTER_LABELS, initialStatus)
      ? initialStatus
      : 'all',
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentFilter: HouseholdListFilter = useMemo(
    () => ({ query, status: statusFilter }),
    [query, statusFilter],
  );

  useEffect(() => {
    const q = new URLSearchParams(searchParams.toString());
    if (query.trim()) q.set('q', query.trim());
    else q.delete('q');
    if (statusFilter !== 'all') q.set('status', statusFilter);
    else q.delete('status');
    const next = q.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(`/dashboard/households${next ? `?${next}` : ''}`, { scroll: false });
    }
  }, [query, statusFilter, router, searchParams]);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetchHouseholds();
    if (res.success && res.data) {
      setItems(res.data as HouseholdRow[]);
    } else {
      setError(res.error?.message ?? 'بارگذاری پرونده‌ها ناموفق بود');
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeDigitsForSearch(query.trim());
    return items.filter((h) => {
      if (statusFilter !== 'all' && h.status !== statusFilter) return false;
      if (!q) return true;
      const status = STATUS_LABELS[h.status] ?? h.status;
      return (
        normalizeDigitsForSearch(h.caseNumber).includes(q) ||
        normalizeDigitsForSearch(status).includes(q) ||
        normalizeDigitsForSearch(h.status).includes(q)
      );
    });
  }, [items, query, statusFilter]);

  function applyFilter(filter: HouseholdListFilter) {
    setQuery(filter.query);
    setStatusFilter(filter.status);
  }

  function selectCase(id: string) {
    const q = new URLSearchParams();
    q.set('case', id);
    if (selectedTab !== defaultHouseholdTab) q.set('tab', selectedTab);
    if (query.trim()) q.set('q', query.trim());
    if (statusFilter !== 'all') q.set('status', statusFilter);
    router.replace(`/dashboard/households?${q.toString()}`, { scroll: false });
  }

  function closeCase() {
    const q = new URLSearchParams();
    if (query.trim()) q.set('q', query.trim());
    if (statusFilter !== 'all') q.set('status', statusFilter);
    const qs = q.toString();
    router.replace(`/dashboard/households${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  async function handleDelete(h: HouseholdRow) {
    const ok = await feedback.confirm(
      `پرونده «${h.caseNumber}» حذف شود؟ این عمل قابل بازگشت از لیست نیست.`,
      'حذف پرونده خانوار',
    );
    if (!ok) return;
    setDeletingId(h.id);
    const res = await deleteHousehold(h.id);
    setDeletingId(null);
    if (!res.success) {
      await feedback.alert(res.error?.message ?? 'حذف ناموفق بود', 'حذف پرونده');
      return;
    }
    feedback.success('پرونده حذف شد');
    if (selectedCaseId === h.id) closeCase();
    setItems((prev) => prev.filter((x) => x.id !== h.id));
  }

  const listContent = (
    <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={6} />} loadingLabel="در حال بارگذاری پرونده‌ها…">
      {filtered.length === 0 ? (
        <div className="hh-empty">
          <NavIcon name="households" size={36} />
          <h3>{items.length === 0 ? 'هنوز پرونده‌ای ثبت نشده' : 'نتیجه‌ای یافت نشد'}</h3>
          <p className="muted">
            {items.length === 0
              ? (canWrite ? 'با دکمه «ثبت خانوار جدید» اولین پرونده را بسازید.' : 'پرونده‌ای برای نمایش نیست.')
              : 'عبارت جستجو را تغییر دهید.'}
          </p>
          {items.length === 0 && canWrite && (
            <Link href="/dashboard/households/new" className="btn btn-primary">
              شروع ثبت پرونده
            </Link>
          )}
        </div>
      ) : (
        <div className="hh-list hh-list--selectable">
          {filtered.map((h) => (
            <article
              key={h.id}
              className={`hh-row ${selectedCaseId === h.id ? 'hh-row--selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => selectCase(h.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCase(h.id); } }}
            >
              <div className="hh-row-main">
                <div className="hh-case">
                  <span className="hh-case-label">شماره پرونده</span>
                  <strong>{toPersianDigits(h.caseNumber)}</strong>
                </div>
                <span className={`hh-status hh-status-${h.status}`}>
                  {STATUS_LABELS[h.status] ?? h.status}
                </span>
                <div className="hh-meta">
                  <span>{formatNumber(h.memberCount)} عضو</span>
                  <span>{formatDate(h.registeredAt)}</span>
                </div>
              </div>
              <div className="hh-row-actions" onClick={(e) => e.stopPropagation()}>
                {presentation === 'split' ? (
                  <Link href={`/dashboard/households/${h.id}`} className="btn btn-sm">
                    صفحه کامل
                  </Link>
                ) : (
                  <Link href={`/dashboard/households/${h.id}`} className="btn btn-primary btn-sm">
                    مشاهده
                  </Link>
                )}
                <Link href={`/dashboard/households/${h.id}/trajectory`} className="btn btn-sm">
                  خط سیر
                </Link>
                {canWrite && (
                <button
                  type="button"
                  className="btn btn-sm hh-delete-btn"
                  disabled={deletingId === h.id}
                  onClick={() => void handleDelete(h)}
                >
                  {deletingId === h.id ? '…' : 'حذف'}
                </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </QueryState>
  );

  return (
    <div className="hh-page hh-page--split">
      <header className="hh-hero">
        <div>
          <p className="hh-kicker">ماژول پرونده</p>
          <h2>پرونده‌های خانوار</h2>
          <p className="hh-lead">ثبت، پیگیری و مدیریت خانوارهای تحت حمایت در محلات هدف</p>
        </div>
        {canWrite && (
        <Link href="/dashboard/households/new" className="btn btn-primary hh-cta">
          <NavIcon name="plus-home" size={18} />
          ثبت خانوار جدید
        </Link>
        )}
      </header>

        <div className="hh-toolbar">
          <label className="hh-search">
            <span className="sr-only">جستجو</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو با شماره پرونده یا وضعیت…"
            />
          </label>
          <label className="hh-status-filter">
            <span className="sr-only">وضعیت</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as HouseholdStatusFilter)}
            >
              {(Object.keys(HOUSEHOLD_STATUS_FILTER_LABELS) as HouseholdStatusFilter[]).map((key) => (
                <option key={key} value={key}>{HOUSEHOLD_STATUS_FILTER_LABELS[key]}</option>
              ))}
            </select>
          </label>
          <div className="hh-stats">
            <span>
              <strong>{formatNumber(items.length)}</strong> پرونده
            </span>
            <span>
              <strong>{formatNumber(filtered.length)}</strong> نمایش
            </span>
            <span>
              <strong>{formatNumber(items.filter((i) => i.status === 'active').length)}</strong> فعال
            </span>
          </div>
        </div>

        <SavedFiltersBar
          scope="households"
          currentFilter={currentFilter}
          onApply={applyFilter}
          equals={householdListFiltersEqual}
          describe={describeHouseholdListFilter}
          isDefault={isDefaultHouseholdListFilter}
        />

      {presentation === 'split' ? (
        <SplitView
          list={listContent}
          detail={selectedCaseId ? (
            <HouseholdDetailPanel
              householdId={selectedCaseId}
              variant="split"
              urlSync="list"
              initialTab={selectedTab}
              onClose={closeCase}
              onDeleted={() => {
                closeCase();
                void load();
              }}
            />
          ) : undefined}
          detailOpen={Boolean(selectedCaseId)}
          onDetailClose={closeCase}
          detailTitle="جزئیات پرونده"
        />
      ) : listContent}
    </div>
  );
}

export default function HouseholdsPage() {
  return (
    <AppShell title="مدیریت خانوار">
      <Suspense fallback={<SkeletonList rows={8} />}>
        <HouseholdsPageContent />
      </Suspense>
    </AppShell>
  );
}
