import {
  resolveDisplayedHouseholdCount,
  resolveDisplayedOptionalMetric,
  resolveDisplayedPopulation,
} from './analytics-types';

describe('resolveDisplayedPopulation', () => {
  it('uses the registered neighborhood population when present', () => {
    expect(resolveDisplayedPopulation(12000, 0)).toBe(12000);
    expect(resolveDisplayedPopulation('8500', 3)).toBe(8500);
  });

  it('falls back to counted members when population was not entered', () => {
    expect(resolveDisplayedPopulation(null, 14)).toBe(14);
    expect(resolveDisplayedPopulation(undefined, 0)).toBe(0);
  });
});

describe('resolveDisplayedHouseholdCount', () => {
  it('prefers registered household count', () => {
    expect(resolveDisplayedHouseholdCount(3200, 12)).toBe(3200);
  });

  it('falls back to case household count', () => {
    expect(resolveDisplayedHouseholdCount(null, 18)).toBe(18);
  });
});

describe('resolveDisplayedOptionalMetric', () => {
  it('prefers registered income and literacy', () => {
    expect(resolveDisplayedOptionalMetric(15_000_000, 9_000_000)).toBe(15_000_000);
    expect(resolveDisplayedOptionalMetric(78.5, 40)).toBe(78.5);
  });

  it('falls back to computed when registered is empty', () => {
    expect(resolveDisplayedOptionalMetric(null, 12_500_000)).toBe(12_500_000);
    expect(resolveDisplayedOptionalMetric(undefined, undefined)).toBeUndefined();
  });
});
