'use client';

type SkeletonProps = {
  lines?: number;
  className?: string;
};

export function Skeleton({ lines = 3, className = '' }: SkeletonProps) {
  return (
    <div className={`skeleton-block ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${Math.max(40, 100 - i * 12)}%` }} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card skeleton-card" aria-hidden="true">
      <Skeleton lines={4} />
    </div>
  );
}
