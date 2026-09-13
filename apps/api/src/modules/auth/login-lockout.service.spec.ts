import { LOGIN_LOCK_MS } from '@city-manager/shared';
import { LoginLockedException, LoginLockoutService } from './login-lockout.service';

describe('LoginLockoutService', () => {
  let svc: LoginLockoutService;

  beforeEach(() => {
    jest.useFakeTimers();
    svc = new LoginLockoutService();
  });

  afterEach(() => {
    svc.onModuleDestroy();
    jest.useRealTimers();
  });

  it('locks for 3 minutes after 3 failures', async () => {
    const key = svc.keyFor('admin', '127.0.0.1');
    expect((await svc.recordFailure(key)).fails).toBe(1);
    expect((await svc.recordFailure(key)).fails).toBe(2);
    await expect(svc.recordFailure(key)).rejects.toBeInstanceOf(LoginLockedException);
    await expect(svc.assertUnlocked(key)).rejects.toBeInstanceOf(LoginLockedException);

    jest.advanceTimersByTime(LOGIN_LOCK_MS - 1_000);
    await expect(svc.assertUnlocked(key)).rejects.toBeInstanceOf(LoginLockedException);

    jest.advanceTimersByTime(2_000);
    await expect(svc.assertUnlocked(key)).resolves.toBeUndefined();
  });

  it('asks to contact admin after the second lock round', async () => {
    const key = svc.keyFor('admin', '10.0.0.1');
    for (let round = 0; round < 2; round += 1) {
      await svc.recordFailure(key);
      await svc.recordFailure(key);
      try {
        await svc.recordFailure(key);
      } catch (e) {
        const body = (e as LoginLockedException).getResponse() as { contactAdmin?: boolean };
        if (round === 0) expect(body.contactAdmin).toBe(false);
        if (round === 1) expect(body.contactAdmin).toBe(true);
      }
      jest.advanceTimersByTime(LOGIN_LOCK_MS + 1);
    }
  });

  it('clears lock after success', async () => {
    const key = svc.keyFor('admin', '1.1.1.1');
    await svc.recordFailure(key);
    await svc.recordSuccess(key);
    await expect(svc.assertUnlocked(key)).resolves.toBeUndefined();
  });
});
