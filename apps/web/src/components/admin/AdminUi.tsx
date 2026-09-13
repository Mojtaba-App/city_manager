'use client';

import Link from 'next/link';
import { formatNumber, toPersianDigits } from '@/lib/format';
import { NavIcon } from '@/components/NavIcons';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="admin-page-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'info';
  icon?: string;
  href?: string;
}) {
  const display =
    typeof value === 'number'
      ? formatNumber(value)
      : value === '—'
        ? value
        : toPersianDigits(value);

  const body = (
    <>
      <div className="admin-stat-top">
        <div className="admin-stat-label">{label}</div>
        {icon && (
          <span className="admin-stat-icon" aria-hidden>
            <NavIcon name={icon} size={18} />
          </span>
        )}
      </div>
      <div className="admin-stat-value">{display}</div>
      {hint && <div className="admin-stat-hint">{toPersianDigits(hint)}</div>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`admin-stat tone-${tone} admin-stat-link`}>
        {body}
      </Link>
    );
  }

  return (
    <div className={`admin-stat tone-${tone}`}>
      {body}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="admin-empty">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}

export function PermissionGate({
  allow,
  children,
  fallback,
}: {
  allow: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (!allow) {
    return (
      <>
        {fallback ?? (
          <div className="card admin-empty">
            <strong>دسترسی غیرمجاز</strong>
            <p>برای مشاهده این بخش مجوز کافی ندارید.</p>
          </div>
        )}
      </>
    );
  }
  return <>{children}</>;
}
