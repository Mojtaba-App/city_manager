import {
  csrfTokensMatch,
  expiryToMaxAgeSeconds,
  parseCookieHeader,
  usesBearerAuthorization,
  AUTH_COOKIE_ACCESS,
  AUTH_COOKIE_CSRF,
} from './auth-session';

describe('auth session helpers', () => {
  it('parses cookie header values', () => {
    expect(parseCookieHeader('cm_access=abc; cm_csrf=xyz%2F1')).toEqual({
      cm_access: 'abc',
      cm_csrf: 'xyz/1',
    });
  });

  it('compares csrf tokens in constant time', () => {
    expect(csrfTokensMatch('abcdefghijklmnop', 'abcdefghijklmnop')).toBe(true);
    expect(csrfTokensMatch('abcdefghijklmnop', 'abcdefghijklmnoq')).toBe(false);
    expect(csrfTokensMatch('short', 'short')).toBe(false);
  });

  it('converts jwt expiry strings to cookie max-age', () => {
    expect(expiryToMaxAgeSeconds('15m', 900)).toBe(900);
    expect(expiryToMaxAgeSeconds('7d', 86400)).toBe(604800);
  });

  it('detects bearer authorization', () => {
    expect(usesBearerAuthorization('Bearer aaa.bbb.ccc')).toBe(true);
    expect(usesBearerAuthorization(undefined)).toBe(false);
  });

  it('exports cookie names', () => {
    expect(AUTH_COOKIE_ACCESS).toBe('cm_access');
    expect(AUTH_COOKIE_CSRF).toBe('cm_csrf');
  });
});
