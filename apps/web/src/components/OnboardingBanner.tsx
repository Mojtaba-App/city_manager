'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getOnboardingStepsForPersona,
  isOnboardingComplete,
  OnboardingStepConfig,
} from '@city-manager/shared';
import { useAuth } from '@/lib/auth';
import { useUxPersona } from '@/lib/use-ux-persona';
import {
  completeOnboardingStep,
  dismissOnboarding,
  loadOnboardingState,
  OnboardingState,
} from '@/lib/onboarding';

export function OnboardingBanner() {
  const { profile } = useAuth();
  const { persona } = useUxPersona();
  const userId = profile?.id;
  const steps = getOnboardingStepsForPersona(persona);

  const [state, setState] = useState<OnboardingState | null>(null);

  useEffect(() => {
    setState(loadOnboardingState(userId));
  }, [userId]);

  if (!state || state.dismissed || isOnboardingComplete(state.completedStepIds, persona)) {
    return null;
  }

  const pending = steps.filter((s) => !state.completedStepIds.includes(s.id));
  if (pending.length === 0) return null;

  function markDone(step: OnboardingStepConfig) {
    const next = completeOnboardingStep(step.id, userId);
    setState(next);
    if (isOnboardingComplete(next.completedStepIds, persona)) {
      dismissOnboarding(userId);
    }
  }

  function dismissAll() {
    setState(dismissOnboarding(userId));
  }

  return (
    <section className="onboarding-banner" aria-label="راهنمای شروع">
      <header className="onboarding-banner-head">
        <div>
          <p className="onboarding-kicker">شروع سریع</p>
          <h3>به سامانه خوش آمدید</h3>
          <p className="muted">۳ قدم کوتاه برای آشنایی با flowهای اصلی</p>
        </div>
        <button type="button" className="btn btn-sm" onClick={dismissAll}>
          دیگر نشان نده
        </button>
      </header>
      <div className="onboarding-steps">
        {pending.map((step, i) => (
          <article key={step.id} className="onboarding-step card">
            <span className="onboarding-step-num">{i + 1}</span>
            <div>
              <h4>{step.title}</h4>
              <p className="muted">{step.body}</p>
              <div className="onboarding-step-actions">
                {step.href ? (
                  <Link href={step.href} className="btn btn-sm btn-primary" onClick={() => markDone(step)}>
                    {step.ctaLabel ?? 'مشاهده'}
                  </Link>
                ) : (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => markDone(step)}>
                    {step.ctaLabel ?? 'متوجه شدم'}
                  </button>
                )}
                <button type="button" className="btn btn-sm" onClick={() => markDone(step)}>
                  انجام شد
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
