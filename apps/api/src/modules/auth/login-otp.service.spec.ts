import { LOGIN_OTP_RESEND_MS } from '@city-manager/shared';
import { LoginOtpService } from './login-otp.service';

describe('LoginOtpService', () => {
  let svc: LoginOtpService;

  beforeEach(() => {
    jest.useFakeTimers();
    svc = new LoginOtpService();
  });

  afterEach(() => {
    svc.onModuleDestroy();
    jest.useRealTimers();
  });

  it('blocks resend until the 2-minute cooldown elapses', async () => {
    const first = await svc.create('u1', '0912***6789');
    expect(svc.resendAfterSec(first)).toBe(120);
    const tooSoon = await svc.resend(first.id);
    expect(tooSoon.ok).toBe(false);
    if (!tooSoon.ok) expect(tooSoon.retryAfterSec).toBeGreaterThan(0);

    jest.advanceTimersByTime(LOGIN_OTP_RESEND_MS + 10);
    const next = await svc.resend(first.id);
    expect(next.ok).toBe(true);
    if (next.ok) {
      expect(next.challenge.id).not.toBe(first.id);
      expect(next.challenge.plainCode).toMatch(/^\d{6}$/);
    }
  });
});
