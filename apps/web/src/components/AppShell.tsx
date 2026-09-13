'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  APP_NAME,
  APP_VERSION,
  canViewDashboardPath,
  clampScrollTop,
  isRangeOutsideView,
  parseSidebarNavScroll,
  SIDEBAR_NAV_SCROLL_KEY,
} from '@city-manager/shared';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS, fetchUiConfig } from '@/lib/admin-api';
import { NavIcon } from '@/components/NavIcons';
import { useTheme } from '@/lib/theme';
import { useFeedback } from '@/components/ui/Feedback';
import {
  DEFAULT_NAV_GROUPS,
  SidebarNavSetting,
  applySidebarOverrides,
} from '@/lib/nav-config';
import { GlobalSearch } from '@/components/GlobalSearch';
import { CommandPalette } from '@/components/CommandPalette';
import { NotificationBell } from '@/components/NotificationBell';
import { usePresenceHeartbeat } from '@/lib/use-presence-heartbeat';

const MOBILE_NAV_MQ = '(max-width: 800px)';

function useIsMobileNav() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_NAV_MQ);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return mobile;
}

export function AppShell({
  children,
  title,
  contentVariant = 'default',
}: {
  children: React.ReactNode;
  title?: string;
  userName?: string;
  contentVariant?: 'default' | 'full-bleed';
}) {
  const pathname = usePathname();
  const isMobileNav = useIsMobileNav();
  const { profile, loading, hasPermission, hasAnyPermission, logout } = useAuth();
  usePresenceHeartbeat(Boolean(profile));
  const { theme, toggleTheme } = useTheme();
  const feedback = useFeedback();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [navOverrides, setNavOverrides] = useState<SidebarNavSetting | null>(null);
  const [branding, setBranding] = useState<{
    logoUrl?: string;
    markText?: string;
    title?: string;
    subtitle?: string;
  } | null>(null);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!isMobileNav) setMobileNavOpen(false);
  }, [isMobileNav]);

  useEffect(() => {
    let cancelled = false;
    async function loadNav() {
      try {
        const res = await fetchUiConfig();
        if (cancelled || !res.success || !res.data) return;
        if (res.data.sidebar_nav) setNavOverrides(res.data.sidebar_nav as SidebarNavSetting);
        if (res.data.org_branding) setBranding(res.data.org_branding);
      } catch {
        /* ignore — use defaults */
      }
    }
    if (profile) void loadNav();
    const onUpdated = () => void loadNav();
    window.addEventListener('cm:sidebar-nav-updated', onUpdated);
    window.addEventListener('cm:branding-updated', onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('cm:sidebar-nav-updated', onUpdated);
      window.removeEventListener('cm:branding-updated', onUpdated);
    };
  }, [profile]);

  const navGroups = useMemo(
    () => applySidebarOverrides(DEFAULT_NAV_GROUPS, navOverrides),
    [navOverrides],
  );

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/dashboard/today') return pathname === '/dashboard/today';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  function persistNavScroll() {
    const el = navRef.current;
    if (!el) return;
    try {
      sessionStorage.setItem(SIDEBAR_NAV_SCROLL_KEY, String(Math.round(el.scrollTop)));
    } catch {
      /* private mode */
    }
  }

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    let saved: number | null = null;
    try {
      saved = parseSidebarNavScroll(sessionStorage.getItem(SIDEBAR_NAV_SCROLL_KEY));
    } catch {
      saved = null;
    }
    if (saved != null) {
      el.scrollTop = clampScrollTop(saved, el.scrollHeight, el.clientHeight);
    }
    const active = el.querySelector<HTMLElement>('a.active');
    if (active) {
      const c = el.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      if (isRangeOutsideView(c.top, c.bottom, a.top, a.bottom)) {
        active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
    persistNavScroll();
  }, [pathname, navGroups, collapsed, isMobileNav, profile, loading]);

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : 'کاربر';

  const roleLabel = profile
    ? profile.roles.map((r) => ROLE_LABELS[r] || r).join('، ')
    : '';

  const subtitle = profile?.jobTitle || roleLabel;

  const brandTitle = branding?.title?.trim() || APP_NAME;
  const brandSubtitle = branding?.subtitle?.trim() || 'پنل مدیریت';
  const brandMark = (branding?.markText?.trim() || 'CM').slice(0, 3);
  const brandLogo = branding?.logoUrl?.trim() || '';

  const shellClass = [
    'admin-shell',
    collapsed && !isMobileNav ? 'sidebar-collapsed' : '',
    mobileNavOpen ? 'mobile-nav-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={shellClass}>
      <a href="#main-content" className="skip-to-content">
        رفتن به محتوا
      </a>

      {mobileNavOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="بستن منو"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className="admin-sidebar" aria-label="منوی اصلی">
        <div className="sidebar-brand">
          <div className="brand-mark">
            {brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brandLogo} alt="" />
            ) : (
              brandMark
            )}
          </div>
          {(!collapsed || isMobileNav) && (
            <div className="brand-text">
              <strong>{brandTitle}</strong>
              <span>{brandSubtitle}</span>
            </div>
          )}
          {isMobileNav && (
            <button
              type="button"
              className="sidebar-mobile-close"
              onClick={() => setMobileNavOpen(false)}
              aria-label="بستن منو"
            >
              ×
            </button>
          )}
        </div>

        <nav
          ref={navRef}
          className="sidebar-nav"
          onScroll={persistNavScroll}
        >
          {navGroups.map((group) => {
            const visible = group.items.filter((i) =>
              canViewDashboardPath(i.href, { hasPermission, hasAnyPermission }),
            );
            if (!visible.length) return null;
            return (
              <div key={group.title} className="nav-group">
                {(!collapsed || isMobileNav) && <div className="nav-group-title">{group.title}</div>}
                {visible.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isActive(item.href) ? 'active' : ''}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => {
                      persistNavScroll();
                      setMobileNavOpen(false);
                    }}
                  >
                    <span className="nav-icon">
                      <NavIcon name={item.icon} />
                    </span>
                    {(!collapsed || isMobileNav) && <span className="nav-label">{item.label}</span>}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {!loading && profile && (
            <Link
              href="/dashboard/profile"
              className={`sidebar-profile ${isActive('/dashboard/profile') ? 'active' : ''}`}
              title="ویرایش پروفایل"
              aria-label="پروفایل من"
              onClick={() => setMobileNavOpen(false)}
            >
              <span className="sidebar-profile-avatar">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" />
                ) : (
                  <span>{profile.firstName?.[0] || 'U'}</span>
                )}
              </span>
              {(!collapsed || isMobileNav) && (
                <span className="sidebar-profile-meta">
                  <strong>{displayName}</strong>
                  <small>{subtitle}</small>
                </span>
              )}
            </Link>
          )}

          <button
            type="button"
            className="sidebar-logout"
            onClick={() => {
              void (async () => {
                const ok = await feedback.confirm(
                  'آیا از خروج از پنل اطمینان دارید؟',
                  'خروج از سامانه',
                );
                if (ok) logout();
              })();
            }}
            title="خروج از سامانه"
            aria-label="خروج"
          >
            <span className="nav-icon"><NavIcon name="logout" /></span>
            {(!collapsed || isMobileNav) && <span>خروج</span>}
          </button>

          {!isMobileNav && (
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}
              aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}
            >
              <NavIcon name={collapsed ? 'collapse' : 'expand'} />
              {!collapsed && <span>جمع کردن</span>}
            </button>
          )}

          {(!collapsed || isMobileNav) && (
            <div className="sidebar-version" title={`نسخه ${APP_VERSION}`}>
              نسخه {APP_VERSION}
            </div>
          )}
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <div className="header-left">
            <button
              type="button"
              className="sidebar-mobile-toggle"
              aria-label="باز کردن منو"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <NavIcon name="dashboard" size={20} />
            </button>
            <h1 className="page-title">{title || 'پنل مدیریت'}</h1>
          </div>
          <div className="header-right">
            <CommandPalette navGroups={navGroups} />
            {hasPermission('org:read') && <GlobalSearch />}
            {hasPermission('notifications:read') && <NotificationBell />}
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
              aria-label={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
            >
              <NavIcon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
              <span className="theme-toggle-label">{theme === 'dark' ? 'روشن' : 'تاریک'}</span>
            </button>
            {!loading && profile && (
              <Link href="/dashboard/profile" className="user-chip" title="ویرایش پروفایل">
                <div className="user-avatar">
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarUrl} alt="" />
                  ) : (
                    profile.firstName?.[0] || 'U'
                  )}
                </div>
                <div className="user-meta">
                  <strong>{displayName}</strong>
                  <span>{subtitle}</span>
                </div>
              </Link>
            )}
          </div>
        </header>
        <main
          id="main-content"
          className={`admin-content${contentVariant === 'full-bleed' ? ' admin-content--full-bleed' : ''}`}
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
