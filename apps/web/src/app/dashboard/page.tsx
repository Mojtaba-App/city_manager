'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { StatCard } from '@/components/admin/AdminUi';
import { NavIcon } from '@/components/NavIcons';
import { NeighborhoodOverview } from '@/components/dashboard/NeighborhoodOverview';
import { useAuth } from '@/lib/auth';
import { fetchAdminDashboard, ROLE_LABELS } from '@/lib/admin-api';
import { fetchChoropleth } from '@/lib/analytics-api';
import { formatNumber } from '@/lib/format';
import { AdminDashboardStats, NeighborhoodChoropleth, firstQueryFailure } from '@city-manager/shared';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useQueryLoad } from '@/lib/use-query-load';

export default function DashboardPage() {
  const { profile, hasPermission } = useAuth();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodChoropleth[]>([]);
  const { loading, error, setError, run } = useQueryLoad();

  useEffect(() => {
    void run(async () => {
      const r = await fetchAdminDashboard();
      if (r.success && r.data) setStats(r.data);
      if (hasPermission('reports:read') || hasPermission('neighborhoods:read')) {
        const ch = await fetchChoropleth({});
        if (ch.success && ch.data) setNeighborhoods(ch.data);
        const fail = firstQueryFailure([r, ch]);
        if (fail) setError(fail);
      } else if (!r.success) {
        setError(r.error?.message ?? 'بارگذاری داشبورد ناموفق بود');
      }
    });
  }, [hasPermission, run, setError]);

  const roleLabel = profile?.roles.map((r) => ROLE_LABELS[r] || r).join('، ') ?? '—';
  const jobLabel = profile?.jobTitle;

  return (
    <AppShell title="داشبورد مدیریتی">
      <section className="dash-welcome">
        <div className="dash-welcome-main">
          <div className="dash-welcome-badge" aria-hidden>
            <NavIcon name="org" size={26} />
          </div>
          <div className="dash-welcome-copy">
            <p className="dash-welcome-kicker">
              <span className="dash-welcome-kicker-icon"><NavIcon name="dashboard" size={14} /></span>
              نمای کلی سازمان
            </p>
            <h2>
              خوش آمدید، {profile?.firstName ?? 'کاربر'}
            </h2>
            <p className="dash-welcome-role">
              <span className="dash-role-pill">
                <NavIcon name="shield-admin" size={15} />
                نقش: {roleLabel}
              </span>
              {jobLabel && (
                <span className="dash-role-pill soft">
                  <NavIcon name="profile" size={15} />
                  {jobLabel}
                </span>
              )}
            </p>
          </div>
        </div>
      </section>

      <QueryState
        loading={loading}
        error={error}
        skeleton={(
          <div className="analytics-loading-grid">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}
        loadingLabel="در حال بارگذاری داشبورد…"
      >
      <div className="admin-stats-grid">
        <StatCard
          label="کاربران فعال"
          value={stats?.usersActive ?? '—'}
          hint={`از ${formatNumber(stats?.usersTotal ?? 0)} کاربر`}
          tone="info"
          icon="users"
          href="/dashboard/users"
        />
        <StatCard
          label="خانوار فعال"
          value={stats?.householdsActive ?? '—'}
          hint={`کل: ${formatNumber(stats?.householdsTotal ?? 0)}`}
          tone="success"
          icon="households"
          href="/dashboard/households?status=active"
        />
        <StatCard label="منازل ثبت‌شده" value={stats?.dwellingsTotal ?? '—'} icon="dwellings" href="/dashboard/households" />
        <StatCard label="محلات" value={stats?.neighborhoodsTotal ?? '—'} icon="neighborhood" href="/dashboard/neighborhoods" />
        <StatCard label="بافت‌ها" value={stats?.fabricsTotal ?? '—'} tone="warning" icon="fabric" href="/dashboard/layers" />
        <StatCard label="رویداد خط سیر" value={stats?.trajectoryEventsTotal ?? '—'} icon="trajectory" href="/dashboard/analytics" />
      </div>

      {(hasPermission('reports:read') || hasPermission('neighborhoods:read')) && (
        <NeighborhoodOverview items={neighborhoods} loading={false} />
      )}
      </QueryState>
    </AppShell>
  );
}
