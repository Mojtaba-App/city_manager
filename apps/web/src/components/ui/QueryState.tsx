'use client';

import { ReactNode } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

type QueryStateProps = {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  skeleton?: ReactNode;
  loadingLabel?: string;
  children: ReactNode;
};

export function QueryState({
  loading,
  error,
  empty,
  emptyMessage = 'داده‌ای موجود نیست',
  skeleton,
  loadingLabel = 'در حال بارگذاری…',
  children,
}: QueryStateProps) {
  if (loading) {
    return (
      <>
        {skeleton ?? (
          <div className="query-state-loading">
            <LoadingSpinner size="md" label={loadingLabel} />
          </div>
        )}
      </>
    );
  }
  if (error) {
    return (
      <div className="query-state-error" role="alert">
        <p>{error}</p>
      </div>
    );
  }
  if (empty) {
    return <p className="muted">{emptyMessage}</p>;
  }
  return <>{children}</>;
}
