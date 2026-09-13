'use client';

import { AppShell } from '@/components/AppShell';
import { TodayDesk } from '@/components/dashboard/TodayDesk';
import { OnboardingBanner } from '@/components/OnboardingBanner';
import { NavIcon } from '@/components/NavIcons';
import { useAuth } from '@/lib/auth';
import { useUxPersona } from '@/lib/use-ux-persona';
import { ROLE_LABELS } from '@/lib/admin-api';

export default function TodayPage() {
  const { profile } = useAuth();
  const { personaLabel } = useUxPersona();

  return (
    <AppShell title="امروز من">
      <section className="today-hero">
        <div className="today-hero-icon" aria-hidden>
          <NavIcon name="welcome" size={28} />
        </div>
        <div>
          <p className="today-hero-kicker">میز کار روزانه</p>
          <h2>سلام {profile?.firstName ?? 'کاربر'}</h2>
          <p className="muted">
            {personaLabel}
            {profile?.roles?.length ? ` · ${profile.roles.map((r) => ROLE_LABELS[r] || r).join('، ')}` : ''}
          </p>
        </div>
      </section>
      <OnboardingBanner />
      <TodayDesk />
    </AppShell>
  );
}
