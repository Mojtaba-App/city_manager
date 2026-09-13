import { ONBOARDING_STORAGE_VERSION } from '@city-manager/shared';

const STORAGE_KEY = 'cm:onboarding';

export interface OnboardingState {
  version: number;
  completedStepIds: string[];
  dismissed: boolean;
  updatedAt: string;
}

function defaultState(): OnboardingState {
  return {
    version: ONBOARDING_STORAGE_VERSION,
    completedStepIds: [],
    dismissed: false,
    updatedAt: new Date().toISOString(),
  };
}

export function loadOnboardingState(userId?: string): OnboardingState {
  if (typeof window === 'undefined') return defaultState();
  const key = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as OnboardingState;
    if (parsed.version !== ONBOARDING_STORAGE_VERSION) return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      completedStepIds: Array.isArray(parsed.completedStepIds) ? parsed.completedStepIds : [],
    };
  } catch {
    return defaultState();
  }
}

export function saveOnboardingState(state: OnboardingState, userId?: string): void {
  if (typeof window === 'undefined') return;
  const key = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
  localStorage.setItem(key, JSON.stringify({
    ...state,
    version: ONBOARDING_STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
  }));
}

export function completeOnboardingStep(stepId: string, userId?: string): OnboardingState {
  const current = loadOnboardingState(userId);
  const completedStepIds = current.completedStepIds.includes(stepId)
    ? current.completedStepIds
    : [...current.completedStepIds, stepId];
  const next = { ...current, completedStepIds };
  saveOnboardingState(next, userId);
  return next;
}

export function dismissOnboarding(userId?: string): OnboardingState {
  const next = { ...loadOnboardingState(userId), dismissed: true };
  saveOnboardingState(next, userId);
  return next;
}

export function resetOnboarding(userId?: string): void {
  if (typeof window === 'undefined') return;
  const key = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
  localStorage.removeItem(key);
}
