'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { HouseholdDetailPanel } from '@/components/case/HouseholdDetailPanel';
import { HouseholdDetailTab } from '@city-manager/shared';
import { useUxPersona } from '@/lib/use-ux-persona';

export default function HouseholdDetailPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { householdTabs, defaultHouseholdTab } = useUxPersona();
  const id = params.id as string;

  const tabFromUrl = searchParams.get('tab') as HouseholdDetailTab | null;
  const initialTab = tabFromUrl && householdTabs.includes(tabFromUrl) ? tabFromUrl : defaultHouseholdTab;

  return (
    <AppShell title="جزئیات پرونده">
      <HouseholdDetailPanel
        householdId={id}
        variant="page"
        urlSync="page"
        initialTab={initialTab}
      />
    </AppShell>
  );
}
