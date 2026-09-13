'use client';

import { AppShell } from '@/components/AppShell';
import { PermissionGate } from '@/components/admin/AdminUi';
import { useDashboardAccess } from '@/lib/use-dashboard-access';

export function DashboardRouteGate({ children }: { children: React.ReactNode }) {
  const { canView } = useDashboardAccess();
  if (canView) return <>{children}</>;
  return (
    <AppShell title="دسترسی غیرمجاز">
      <PermissionGate allow={false}>{null}</PermissionGate>
    </AppShell>
  );
}
