'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader, PermissionGate } from '@/components/admin/AdminUi';
import { useAuth } from '@/lib/auth';
import { fetchAdminUser, ROLE_LABELS } from '@/lib/admin-api';
import { ClientPlatformBadge } from '@/components/admin/ClientPlatformBadge';
import { OnlineIndicator } from '@/components/ui/OnlineIndicator';
import { usePresenceStream } from '@/lib/use-presence-stream';
import { type PresenceSnapshot } from '@city-manager/shared';
import { formatDate } from '@/lib/format';
import { QueryState } from '@/components/ui/QueryState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useQueryLoad } from '@/lib/use-query-load';

type AdminUserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  isActive: boolean;
  roles: string[];
  lastLoginAt?: string;
  lastLoginIp?: string;
  lastLoginUserAgent?: string;
  inactiveReason?: string;
  inactiveAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="profile-read-field">
      <span className="profile-read-label">{label}</span>
      <span className="profile-read-value">{value?.trim() ? value : '—'}</span>
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = String(params?.id ?? '');
  const { hasPermission } = useAuth();
  const canRead = hasPermission('users:read');
  const canWrite = hasPermission('users:write');
  const [user, setUser] = useState<AdminUserProfile | null>(null);
  const [presence, setPresence] = useState<PresenceSnapshot | null>(null);
  const { loading, error, setError, run } = useQueryLoad();

  usePresenceStream(userId ? [userId] : [], canRead && Boolean(userId), {
    onSnapshot: (data) => {
      if (data[userId]) setPresence(data[userId]);
    },
    onPresence: (snap) => {
      if (snap.userId === userId) setPresence(snap);
    },
  });

  useEffect(() => {
    if (!canRead || !userId) return;
    void run(async () => {
      const res = await fetchAdminUser(userId);
      if (res.success && res.data) {
        setUser(res.data as AdminUserProfile);
      } else if (!res.success) setError(res.error?.message ?? 'بارگذاری پروفایل ناموفق بود');
    });
  }, [canRead, userId]);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.trim() || 'U'
    : 'U';
  const roleLabel = user?.roles.map((r) => ROLE_LABELS[r] || r).join('، ') ?? '—';

  return (
    <AppShell title="پروفایل کاربر">
      <PermissionGate allow={canRead}>
        <PageHeader
          title="پروفایل کاربر"
          description="اطلاعات هویتی و سازمانی کاربر (فقط مشاهده)"
          actions={
            <div className="admin-page-actions">
              <Link href="/dashboard/users" className="btn">بازگشت به فهرست</Link>
              {canWrite && user && (
                <Link href={`/dashboard/users?edit=${user.id}`} className="btn btn-primary">
                  ویرایش حساب
                </Link>
              )}
            </div>
          }
        />

        <QueryState
          loading={loading}
          error={error}
          skeleton={<SkeletonList rows={5} />}
          loadingLabel="در حال بارگذاری پروفایل…"
        >
          {user && (
            <div className="profile-layout profile-read-layout">
              <aside className="card profile-aside">
                <div className="profile-avatar-wrap">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="آواتار" className="profile-avatar-img" />
                  ) : (
                    <div className="profile-avatar-fallback">{initials}</div>
                  )}
                </div>
                <div className="profile-aside-meta">
                  <strong className="profile-name-with-presence">
                    <OnlineIndicator presence={presence} size="md" showLabel />
                    <span>{user.firstName} {user.lastName}</span>
                  </strong>
                  <span>{roleLabel}</span>
                  <span className="mono">{user.email}</span>
                </div>
                <span className={`status-pill ${user.isActive ? 'ok' : 'off'}`}>
                  {user.isActive ? 'فعال' : 'غیرفعال'}
                </span>
                {!user.isActive && user.inactiveReason && (
                  <p className="profile-inactive-reason muted">
                    دلیل: {user.inactiveReason}
                    {user.inactiveAt && (
                      <span className="profile-inactive-at"> · {formatDate(user.inactiveAt)}</span>
                    )}
                  </p>
                )}
              </aside>

              <div className="card profile-form-card profile-read-card">
                <h3>اطلاعات پایه</h3>
                <div className="profile-read-grid">
                  <Field label="نام" value={user.firstName} />
                  <Field label="نام خانوادگی" value={user.lastName} />
                  <Field label="ایمیل" value={user.email} />
                  <Field label="شماره همراه" value={user.phone} />
                  <Field label="آخرین ورود" value={formatDate(user.lastLoginAt)} />
                  <Field label="تاریخ ایجاد" value={formatDate(user.createdAt)} />
                </div>

                <h3 className="profile-section-title">آخرین نشست ورود</h3>
                <div className="profile-read-grid">
                  <Field label="آدرس IP" value={user.lastLoginIp} />
                  <div className="profile-read-field">
                    <span className="profile-read-label">سیستم‌عامل / دستگاه</span>
                    <span className="profile-read-value">
                      {user.lastLoginUserAgent ? (
                        <ClientPlatformBadge userAgent={user.lastLoginUserAgent} />
                      ) : '—'}
                    </span>
                  </div>
                </div>

                <h3 className="profile-section-title">سمت در پروژه بازآفرینی</h3>
                <div className="profile-read-grid">
                  <Field label="سمت / نقش اجرایی" value={user.jobTitle} />
                  <Field label="واحد / حوزه" value={user.department} />
                </div>
                <div className="profile-read-bio">
                  <span className="profile-read-label">درباره</span>
                  <p className="profile-read-value">{user.bio?.trim() ? user.bio : '—'}</p>
                </div>
              </div>
            </div>
          )}
        </QueryState>
      </PermissionGate>
    </AppShell>
  );
}
