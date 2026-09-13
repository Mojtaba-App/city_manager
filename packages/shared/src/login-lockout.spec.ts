import {
  formatCountdownMmSs,
  loginLockMessage,
  LOGIN_CONTACT_ADMIN_MESSAGE,
  LOGIN_FAIL_LIMIT,
  LOGIN_LOCK_MS,
  LOGIN_OTP_RESEND_MS,
} from './login-lockout';

describe('login-lockout helpers', () => {
  it('formats mm:ss', () => {
    expect(formatCountdownMmSs(125)).toBe('2:05');
    expect(formatCountdownMmSs(0)).toBe('0:00');
    expect(formatCountdownMmSs(-3)).toBe('0:00');
  });

  it('uses contact-admin copy after second lock round', () => {
    expect(loginLockMessage(10, true)).toBe(LOGIN_CONTACT_ADMIN_MESSAGE);
    expect(loginLockMessage(180, false)).toContain('۳ دقیقه');
  });

  it('exports lock and resend windows', () => {
    expect(LOGIN_FAIL_LIMIT).toBe(3);
    expect(LOGIN_LOCK_MS).toBe(180_000);
    expect(LOGIN_OTP_RESEND_MS).toBe(120_000);
  });
});
