'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TodayWidgetConfig,
  TodayWidgetId,
  buildHouseholdUrl,
  getQuickActionsForPersona,
  UxPersona,
} from '@city-manager/shared';
import { NavIcon } from '@/components/NavIcons';
import { QueryState } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useUxPersona } from '@/lib/use-ux-persona';
import { useAuth } from '@/lib/auth';
import { fetchMyTasks, fetchOverdueTasks } from '@/lib/operations-api';
import { fetchMyVisits, fetchFieldToday, fetchUnreadCount } from '@/lib/collaboration-api';
import { fetchAdminDashboard } from '@/lib/admin-api';
import { loadRecentHouseholds } from '@/lib/recent-items';
import { formatDateTime, formatNumber } from '@/lib/format';
import { AdminDashboardStats } from '@city-manager/shared';

function getQuickActions(persona: UxPersona) {
  return getQuickActionsForPersona(persona).map((a) => ({
    label: a.label,
    href: a.href,
    icon: a.icon,
  }));
}

function WidgetShell({
  widget,
  loading,
  error,
  children,
}: {
  widget: TodayWidgetConfig;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`today-widget ${widget.span === 2 ? 'today-widget-wide' : ''}`}
      aria-labelledby={`widget-${widget.id}`}
    >
      <header className="today-widget-head">
        <h3 id={`widget-${widget.id}`}>{widget.label}</h3>
        <p className="muted">{widget.description}</p>
      </header>
      <QueryState loading={loading} error={error} skeleton={<Skeleton lines={3} />} loadingLabel="در حال بارگذاری میز کار امروز…">
        {children}
      </QueryState>
    </section>
  );
}

function TodayWidgetContent({ widget }: { widget: TodayWidgetConfig }) {
  const router = useRouter();
  const { persona } = useUxPersona();
  const { hasPermission, hasAnyPermission } = useAuth();
  const [loading, setLoading] = useState(widget.id !== 'quick_actions' && widget.id !== 'recent_households');
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<unknown[]>([]);
  const [overdue, setOverdue] = useState<unknown[]>([]);
  const [visits, setVisits] = useState<unknown[]>([]);
  const [fieldSummary, setFieldSummary] = useState<Record<string, number>>({});
  const [unread, setUnread] = useState(0);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [recent, setRecent] = useState(loadRecentHouseholds());

  useEffect(() => {
    setRecent(loadRecentHouseholds());
  }, []);

  useEffect(() => {
    if (widget.id === 'quick_actions' || widget.id === 'recent_households') return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        switch (widget.id as TodayWidgetId) {
          case 'my_tasks': {
            const res = await fetchMyTasks();
            if (!cancelled && res.success) {
              const rows = (res.data as Array<Record<string, unknown>>) ?? [];
              setTasks(rows.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'));
            }
            break;
          }
          case 'overdue_tasks': {
            const res = await fetchOverdueTasks();
            if (!cancelled && res.success) setOverdue((res.data as unknown[]) ?? []);
            break;
          }
          case 'field_visits': {
            const res = await fetchMyVisits();
            if (!cancelled && res.success) setVisits((res.data as unknown[]) ?? []);
            break;
          }
          case 'field_summary': {
            const res = await fetchFieldToday();
            if (!cancelled && res.success) setFieldSummary(res.data ?? {});
            break;
          }
          case 'notifications': {
            const res = await fetchUnreadCount();
            if (!cancelled && res.success) setUnread(res.data?.count ?? 0);
            break;
          }
          case 'admin_stats': {
            const res = await fetchAdminDashboard();
            if (!cancelled && res.success) setStats(res.data ?? null);
            break;
          }
          default:
            break;
        }
      } catch {
        if (!cancelled) setError('بارگذاری ناموفق بود');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [widget.id]);

  if (widget.id === 'quick_actions') {
    const actions = getQuickActions(persona).filter((a) => {
      if (a.href.includes('households/new')) return hasPermission('households:write');
      if (a.href.includes('operations')) return hasPermission('operations:read');
      if (a.href.includes('notifications')) return hasPermission('notifications:read');
      if (a.href.includes('field')) return hasPermission('field:access');
      if (a.href.includes('layers')) return hasPermission('gis_layers:read');
      if (a.href.includes('neighborhoods')) return hasPermission('neighborhoods:read');
      if (a.href.includes('reports') || a.href.includes('analytics')) return hasPermission('reports:read');
      if (a.href.includes('users')) return hasPermission('users:read');
      if (a.href.includes('settings')) return hasPermission('settings:read');
      if (a.href.includes('map')) return hasAnyPermission(['gis_layers:read', 'dwellings:read']);
      return true;
    });

    return (
      <WidgetShell widget={widget}>
        <div className="today-quick-actions">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="today-quick-btn">
              <NavIcon name={a.icon} size={18} />
              <span>{a.label}</span>
            </Link>
          ))}
        </div>
      </WidgetShell>
    );
  }

  if (widget.id === 'recent_households') {
    return (
      <WidgetShell widget={widget}>
        {recent.length === 0 ? (
          <p className="muted">هنوز پرونده‌ای باز نکرده‌اید</p>
        ) : (
          <ul className="today-list">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={buildHouseholdUrl(r.id)}>
                  <strong>{r.label ?? `پرونده ${r.caseNumber}`}</strong>
                  <small>{formatDateTime(r.visitedAt)}</small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </WidgetShell>
    );
  }

  return (
    <WidgetShell widget={widget} loading={loading} error={error}>
      {widget.id === 'my_tasks' && (
        tasks.length === 0 ? <p className="muted">وظیفه بازی نیست</p> : (
          <ul className="today-list">
            {tasks.slice(0, 5).map((t) => {
              const row = t as Record<string, unknown>;
              const hhId = String(row.householdId ?? '');
              return (
                <li key={String(row.id)}>
                  <button type="button" className="today-list-btn" onClick={() => router.push(buildHouseholdUrl(hhId, 'operations'))}>
                    <strong>{String(row.title ?? 'وظیفه')}</strong>
                    {row.dueAt != null && String(row.dueAt) !== '' && (
                      <small>مهلت: {formatDateTime(String(row.dueAt))}</small>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}
      {widget.id === 'overdue_tasks' && (
        overdue.length === 0 ? <p className="muted">تأخیر عملیاتی ندارید</p> : (
          <ul className="today-list today-list-warn">
            {overdue.slice(0, 5).map((t) => {
              const row = t as Record<string, unknown>;
              return (
                <li key={String(row.id)}>
                  <button type="button" className="today-list-btn" onClick={() => router.push(buildHouseholdUrl(String(row.householdId ?? ''), 'operations'))}>
                    <strong>{String(row.title ?? 'وظیفه')}</strong>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}
      {widget.id === 'field_visits' && (
        visits.length === 0 ? <p className="muted">بازدیدی ثبت نشده</p> : (
          <ul className="today-list">
            {visits.slice(0, 6).map((v) => {
              const row = v as Record<string, unknown>;
              return (
                <li key={String(row.id)}>
                  <Link href="/dashboard/field">
                    <strong>{String(row.householdCaseNumber ?? row.title ?? 'بازدید')}</strong>
                    <small>{String(row.status ?? '')}</small>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      )}
      {widget.id === 'field_summary' && (
        <div className="today-stat-row">
          <div><span>امروز</span><strong>{formatNumber(fieldSummary.today ?? 0)}</strong></div>
          <div><span>انجام‌شده</span><strong>{formatNumber(fieldSummary.completed ?? 0)}</strong></div>
          <div><span>باقی‌مانده</span><strong>{formatNumber(fieldSummary.pending ?? 0)}</strong></div>
        </div>
      )}
      {widget.id === 'notifications' && (
        <div className="today-notif-count">
          <strong>{formatNumber(unread)}</strong>
          <span>اعلان خوانده‌نشده</span>
          <Link href="/dashboard/notifications" className="btn btn-sm btn-primary">مشاهده</Link>
        </div>
      )}
      {widget.id === 'admin_stats' && stats && (
        <div className="today-stat-row">
          <div><span>خانوار فعال</span><strong>{formatNumber(Number(stats.householdsActive ?? 0))}</strong></div>
          <div><span>کاربران</span><strong>{formatNumber(Number(stats.usersActive ?? 0))}</strong></div>
          <div><span>محلات</span><strong>{formatNumber(Number(stats.neighborhoodsTotal ?? 0))}</strong></div>
        </div>
      )}
    </WidgetShell>
  );
}

export function TodayDesk() {
  const { todayWidgets, personaLabel } = useUxPersona();

  return (
    <div className="today-desk">
      <p className="today-desk-persona muted">چیدمان پیشنهادی برای {personaLabel}</p>
      <div className="today-desk-grid">
        {todayWidgets.map((w) => (
          <TodayWidgetContent key={w.id} widget={w} />
        ))}
      </div>
    </div>
  );
}
