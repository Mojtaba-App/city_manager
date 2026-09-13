import { HouseholdStatus } from './case-types';
import {
  HOUSEHOLD_STATUS_TRANSITIONS,
  canCreateHouseholdWithStatus,
  canTransitionHouseholdStatus,
  getAllowedHouseholdStatusTransitions,
  householdStatusTransitionError,
} from './household-status';

describe('household status transition matrix', () => {
  it('covers every HouseholdStatus', () => {
    for (const status of Object.values(HouseholdStatus)) {
      expect(HOUSEHOLD_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('allows draft → active and blocks draft → graduated', () => {
    expect(canTransitionHouseholdStatus(HouseholdStatus.DRAFT, HouseholdStatus.ACTIVE)).toBe(true);
    expect(canTransitionHouseholdStatus(HouseholdStatus.DRAFT, HouseholdStatus.GRADUATED)).toBe(false);
  });

  it('treats same-status as a no-op', () => {
    expect(canTransitionHouseholdStatus(HouseholdStatus.ACTIVE, HouseholdStatus.ACTIVE)).toBe(true);
    expect(householdStatusTransitionError(HouseholdStatus.ACTIVE, HouseholdStatus.ACTIVE)).toBeUndefined();
  });

  it('makes archived terminal', () => {
    expect(getAllowedHouseholdStatusTransitions(HouseholdStatus.ARCHIVED)).toEqual([]);
    expect(canTransitionHouseholdStatus(HouseholdStatus.ARCHIVED, HouseholdStatus.ACTIVE)).toBe(false);
  });

  it('returns a Persian error for illegal moves', () => {
    const err = householdStatusTransitionError(HouseholdStatus.DRAFT, HouseholdStatus.SUSPENDED);
    expect(err).toContain('مجاز نیست');
  });

  it('restricts create statuses to draft/active', () => {
    expect(canCreateHouseholdWithStatus(undefined)).toBe(true);
    expect(canCreateHouseholdWithStatus(HouseholdStatus.DRAFT)).toBe(true);
    expect(canCreateHouseholdWithStatus(HouseholdStatus.ACTIVE)).toBe(true);
    expect(canCreateHouseholdWithStatus(HouseholdStatus.ARCHIVED)).toBe(false);
  });
});
