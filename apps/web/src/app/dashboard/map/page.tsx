'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getProfile } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const MapWorkspace = dynamic(
  () => import('@/components/gis/MapWorkspace').then((m) => m.MapWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="admin-loading">
        <LoadingSpinner size="lg" label="در حال بارگذاری نقشه…" />
      </div>
    ),
  },
);

function MapPageInner() {
  return <MapWorkspace />;
}

export default function MapPage() {
  const router = useRouter();

  useEffect(() => {
    getProfile().then((res) => {
      if (!res.success) router.replace('/login');
    });
  }, [router]);

  return (
    <AppShell title="نقشه GIS" contentVariant="full-bleed">
      <Suspense fallback={(
        <div className="admin-loading">
          <LoadingSpinner size="lg" label="در حال بارگذاری نقشه…" />
        </div>
      )}>
        <MapPageInner />
      </Suspense>
    </AppShell>
  );
}
