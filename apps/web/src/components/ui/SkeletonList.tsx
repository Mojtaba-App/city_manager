'use client';

import { Skeleton } from './Skeleton';

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-list-row">
          <Skeleton lines={2} />
        </div>
      ))}
    </div>
  );
}
