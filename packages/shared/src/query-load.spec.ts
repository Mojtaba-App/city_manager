import { firstQueryFailure, toQueryError } from './query-load';

describe('toQueryError', () => {
  it('uses string and Error.message', () => {
    expect(toQueryError('خطای شبکه')).toBe('خطای شبکه');
    expect(toQueryError(new Error('timeout'))).toBe('timeout');
  });

  it('falls back for empty values', () => {
    expect(toQueryError(null)).toBe('بارگذاری ناموفق بود');
    expect(toQueryError({})).toBe('بارگذاری ناموفق بود');
  });
});

describe('firstQueryFailure', () => {
  it('returns null if any request succeeded', () => {
    expect(firstQueryFailure([{ success: true }, { success: false, error: { message: 'x' } }])).toBeNull();
  });

  it('returns first error when all failed', () => {
    expect(
      firstQueryFailure([
        { success: false, error: { message: 'الف' } },
        { success: false, error: { message: 'ب' } },
      ]),
    ).toBe('الف');
  });
});
