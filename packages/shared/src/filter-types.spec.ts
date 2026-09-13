import {
  DEFAULT_HOUSEHOLD_LIST_FILTER,
  analyticsFilterHasErrors,
  analyticsFiltersEqual,
  describeAnalyticsFilter,
  describeHouseholdListFilter,
  firstAnalyticsFilterError,
  householdListFiltersEqual,
  isDefaultAnalyticsFilter,
  isDefaultHouseholdListFilter,
  normalizeAnalyticsFilter,
  validateAnalyticsFilter,
} from './filter-types';

describe('filter-types', () => {
  it('detects default household filter', () => {
    expect(isDefaultHouseholdListFilter(DEFAULT_HOUSEHOLD_LIST_FILTER)).toBe(true);
    expect(isDefaultHouseholdListFilter({ query: 'x', status: 'all' })).toBe(false);
    expect(isDefaultHouseholdListFilter({ query: '', status: 'active' })).toBe(false);
  });

  it('describes household filter', () => {
    expect(describeHouseholdListFilter(DEFAULT_HOUSEHOLD_LIST_FILTER)).toBe('همه پرونده‌ها');
    expect(describeHouseholdListFilter({ query: '12', status: 'active' }))
      .toBe('فعال · جستجو: 12');
  });

  it('compares household filters', () => {
    expect(householdListFiltersEqual(
      { query: ' a ', status: 'draft' },
      { query: 'a', status: 'draft' },
    )).toBe(true);
    expect(householdListFiltersEqual(
      { query: '', status: 'all' },
      { query: '', status: 'active' },
    )).toBe(false);
  });

  it('detects default analytics filter', () => {
    expect(isDefaultAnalyticsFilter({})).toBe(true);
    expect(isDefaultAnalyticsFilter({ incomeMin: 1000 })).toBe(false);
    expect(isDefaultAnalyticsFilter({ neighborhoodIds: [] })).toBe(true);
  });

  it('normalizes analytics filter arrays', () => {
    expect(normalizeAnalyticsFilter({
      neighborhoodIds: ['b', 'a', 'a'],
      incomeMin: 5000,
      fromDate: ' 1403/01/01 ',
    })).toEqual({
      neighborhoodIds: ['a', 'b'],
      incomeMin: 5000,
      fromDate: '1403/01/01',
    });
  });

  it('compares analytics filters regardless of array order', () => {
    expect(analyticsFiltersEqual(
      { neighborhoodIds: ['n2', 'n1'], incomeMin: 100 },
      { neighborhoodIds: ['n1', 'n2'], incomeMin: 100 },
    )).toBe(true);
    expect(analyticsFiltersEqual(
      { incomeMin: 100 },
      { incomeMin: 200 },
    )).toBe(false);
  });

  it('describes analytics filter', () => {
    expect(describeAnalyticsFilter({})).toBe('بدون فیلتر');
    expect(describeAnalyticsFilter({
      neighborhoodIds: ['a', 'b'],
      incomeMin: 1_000_000,
      incomeMax: 5_000_000,
    })).toContain('2 محله');
  });

  it('validates analytics income and date ranges', () => {
    expect(analyticsFilterHasErrors(validateAnalyticsFilter({}))).toBe(false);
    expect(validateAnalyticsFilter({ incomeMin: -1 }).incomeMin).toBeTruthy();
    expect(validateAnalyticsFilter({ incomeMin: 10, incomeMax: 5 }).incomeRange).toBeTruthy();
    expect(validateAnalyticsFilter({ fromDate: '2024-05-01', toDate: '2024-01-01' }).dateRange).toBeTruthy();
    expect(validateAnalyticsFilter({ fromDate: 'bad' }).fromDate).toBeTruthy();
    expect(firstAnalyticsFilterError(validateAnalyticsFilter({ incomeMin: -1 }))).toContain('درآمد');
    expect(analyticsFilterHasErrors(validateAnalyticsFilter({
      incomeMin: 1_000_000,
      incomeMax: 5_000_000,
      fromDate: '2024-01-01',
      toDate: '2024-06-01',
    }))).toBe(false);
  });
});
