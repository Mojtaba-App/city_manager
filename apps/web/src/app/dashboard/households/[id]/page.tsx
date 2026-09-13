'use client';

import { Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import HouseholdDetailPageInner from './HouseholdDetailInner';

export default function HouseholdDetailPage() {
  return (
    <Suspense fallback={(
      <div className="admin-loading">
        <LoadingSpinner size="lg" label="در حال بارگذاری پرونده…" />
      </div>
    )}>
      <HouseholdDetailPageInner />
    </Suspense>
  );
}
