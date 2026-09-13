'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { EmptyState, PageHeader } from '@/components/admin/AdminUi';
import { NavIcon } from '@/components/NavIcons';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/collaboration-api';
import { NOTIFICATION_TYPE_LABELS, NotificationType } from '@city-manager/shared';
import { formatDateTime, formatNumber } from '@/lib/format';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';

type NotifFilter = 'all' | 'tasks' | 'visits' | 'referrals' | 'ops';

const FILTER_TABS: Array<{ id: NotifFilter; label: string }> = [
  { id: 'all', label: 'همه' },
  { id: 'tasks', label: 'وظایف' },
  { id: 'visits', label: 'بازدیدها' },
  { id: 'referrals', label: 'ارجاع‌ها' },
  { id: 'ops', label: 'عملیات' },
];

const TYPE_META: Record<string, { icon: string; tone: string; filter: NotifFilter }> = {
  [NotificationType.TASK_ASSIGNED]: { icon: 'activity', tone: 'task', filter: 'tasks' },
  [NotificationType.TASK_OVERDUE]: { icon: 'activity', tone: 'warn', filter: 'tasks' },
  [NotificationType.VISIT_SCHEDULED]: { icon: 'map', tone: 'visit', filter: 'visits' },
  [NotificationType.HOUSEHOLD_ASSIGNED]: { icon: 'households', tone: 'task', filter: 'tasks' },
  [NotificationType.REFERRAL_CREATED]: { icon: 'integrations', tone: 'referral', filter: 'referrals' },
  [NotificationType.REFERRAL_STATUS]: { icon: 'integrations', tone: 'referral', filter: 'referrals' },
  [NotificationType.CONSENT_REQUIRED]: { icon: 'shield-admin', tone: 'referral', filter: 'referrals' },
  [NotificationType.DOCUMENT_UPLOADED]: { icon: 'upload', tone: 'info', filter: 'ops' },
  [NotificationType.SYNC_FAILED]: { icon: 'integrations', tone: 'warn', filter: 'ops' },
  [NotificationType.SYSTEM]: { icon: 'settings', tone: 'system', filter: 'ops' },
};

function metaForType(type: unknown) {
  const key = String(type);
  return TYPE_META[key] ?? { icon: 'bell', tone: 'system', filter: 'ops' as NotifFilter };
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotifFilter>('all');
  const [markingAll, setMarkingAll] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetchNotifications(false);
    if (res.success && res.data) {
      setItems(res.data);
    } else {
      setError(res.error?.message ?? 'بارگذاری اعلان‌ها ناموفق بود');
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.isRead).length,
    [items],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((n) => metaForType(n.type).filter === filter);
  }, [items, filter]);

  const filterCounts = useMemo(() => {
    const counts: Record<NotifFilter, number> = {
      all: items.length,
      tasks: 0,
      visits: 0,
      referrals: 0,
      ops: 0,
    };
    for (const n of items) {
      counts[metaForType(n.type).filter] += 1;
    }
    return counts;
  }, [items]);

  async function handleMarkAllRead() {
    setMarkingAll(true);
    await markAllNotificationsRead();
    await load();
    setMarkingAll(false);
  }

  return (
    <AppShell title="مرکز اعلان‌ها">
      <div className="notif-page">
        <PageHeader
          title="اعلان‌های درون‌برنامه‌ای"
          description="وظایف، بازدیدها، ارجاع‌ها و رویدادهای عملیاتی"
          actions={
            <div className="notif-header-actions">
              <button type="button" className="btn btn-sm" disabled={loading} onClick={() => void load()}>
                بروزرسانی
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={loading || markingAll || unreadCount === 0}
                onClick={() => void handleMarkAllRead()}
              >
                {markingAll ? '…' : 'خواندن همه'}
              </button>
            </div>
          }
        />

        <div className="notif-stats">
          <div className="notif-stat-card notif-stat-unread">
            <span>خوانده‌نشده</span>
            <strong>{formatNumber(unreadCount)}</strong>
          </div>
          <div className="notif-stat-card">
            <span>کل اعلان‌ها</span>
            <strong>{formatNumber(items.length)}</strong>
          </div>
          <div className="notif-stat-card notif-stat-filter">
            <span>فیلتر فعال</span>
            <strong>{FILTER_TABS.find((t) => t.id === filter)?.label ?? 'همه'}</strong>
          </div>
        </div>

        <div className="notif-filter-bar" role="tablist" aria-label="فیلتر نوع اعلان">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`notif-filter-chip ${filter === tab.id ? 'active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              <span className="notif-filter-count">{formatNumber(filterCounts[tab.id])}</span>
            </button>
          ))}
        </div>

        <QueryState loading={loading} error={error} skeleton={<SkeletonList rows={5} />} loadingLabel="در حال بارگذاری اعلان‌ها…">
          {filtered.length === 0 ? (
            <EmptyState
              title={items.length === 0 ? 'اعلانی ثبت نشده' : 'اعلانی در این دسته نیست'}
              description={
                items.length === 0
                  ? 'وقتی وظیفه، بازدید یا ارجاع جدید داشته باشید اینجا نمایش داده می‌شود.'
                  : 'فیلتر دیگری را امتحان کنید یا «همه» را انتخاب کنید.'
              }
            />
          ) : (
            <ul className="notif-feed">
              {filtered.map((n) => {
                const type = String(n.type);
                const meta = metaForType(type);
                const typeLabel = NOTIFICATION_TYPE_LABELS[type as NotificationType] ?? type;
                const isUnread = !n.isRead;
                const link = typeof n.link === 'string' ? n.link : '';

                return (
                  <li
                    key={String(n.id)}
                    className={`notif-feed-item ${isUnread ? 'unread' : ''}`}
                  >
                    <div className={`notif-feed-icon tone-${meta.tone}`} aria-hidden>
                      <NavIcon name={meta.icon} size={20} />
                    </div>

                    <div className="notif-feed-body">
                      <div className="notif-feed-head">
                        <span className={`notif-type-pill tone-${meta.tone}`}>{typeLabel}</span>
                        {isUnread && <span className="notif-unread-dot" title="خوانده نشده" />}
                        <time>{formatDateTime(String(n.createdAt))}</time>
                      </div>
                      <strong className="notif-feed-title">{String(n.title)}</strong>
                      {n.body != null && String(n.body).trim() !== '' && (
                        <p className="notif-feed-body-text muted">{String(n.body)}</p>
                      )}
                    </div>

                    <div className="notif-feed-actions">
                      {link && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary notif-action-primary"
                          onClick={() => router.push(link)}
                        >
                          مشاهده
                        </button>
                      )}
                      {isUnread && (
                        <button
                          type="button"
                          className="btn btn-sm notif-action-ghost"
                          onClick={() => void markNotificationRead(String(n.id)).then(() => load())}
                        >
                          علامت خوانده
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </QueryState>
      </div>
    </AppShell>
  );
}
