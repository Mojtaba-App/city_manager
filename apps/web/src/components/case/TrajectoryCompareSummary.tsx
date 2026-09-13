'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrajectoryCompareResult } from '@city-manager/shared';
import { fetchCompare } from '@/lib/trajectory-api';
import { QueryState } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';

export function TrajectoryCompareSummary({ householdId }: { householdId: string }) {
  const [data, setData] = useState<TrajectoryCompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void fetchCompare(householdId).then((res) => {
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error?.message ?? 'دریافت خلاصه مسیر تحول ناموفق بود');
      }
      setLoading(false);
    });
  }, [householdId]);

  const changed = data?.changes.filter((c) => c.changed) ?? [];

  return (
    <div className="card trajectory-summary">
      <div className="trajectory-summary-head">
        <h4>خلاصه مسیر تحول</h4>
        <Link href={`/dashboard/households/${householdId}/trajectory`} className="btn btn-sm">
          جزئیات
        </Link>
      </div>
      <QueryState
        loading={loading}
        error={error}
        empty={!loading && !error && changed.length === 0}
        emptyMessage="تغییر معناداری در بازه ثبت نشده"
        skeleton={<Skeleton lines={3} />}
      >
        {data && changed.length > 0 && (
          <ul className="trajectory-summary-list">
            {changed.slice(0, 4).map((c) => (
              <li key={c.field}>
                <span>{c.label}</span>
                <span className="muted">{String(c.before ?? '—')} → {String(c.after ?? '—')}</span>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
