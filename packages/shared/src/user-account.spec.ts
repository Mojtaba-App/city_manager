import {
  USER_INACTIVE_REASON_PRESETS,
  CLIENT_PLATFORM_LABELS,
  parseClientPlatform,
  resolveInactiveReason,
  validateInactiveReason,
} from './user-account';

describe('user-account', () => {
  it('validates inactive reason length', () => {
    expect(validateInactiveReason('')).toContain('۳ کاراکتر');
    expect(validateInactiveReason('ok')).toContain('۳ کاراکتر');
    expect(validateInactiveReason('دلیل معتبر')).toBeUndefined();
  });

  it('resolves preset and custom inactive reasons', () => {
    expect(resolveInactiveReason('security').reason).toBe('نقض مقررات امنیتی');
    expect(resolveInactiveReason('custom', '   ').error).toBeTruthy();
    expect(resolveInactiveReason('custom', 'انتقال به سامانه دیگر').reason).toBe('انتقال به سامانه دیگر');
    expect(resolveInactiveReason('bad-id').error).toBeTruthy();
  });

  it('labels every preset', () => {
    expect(USER_INACTIVE_REASON_PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const p of USER_INACTIVE_REASON_PRESETS) {
      expect(p.label.length).toBeGreaterThan(2);
    }
  });

  it('detects common client platforms from user agent', () => {
    expect(parseClientPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)').platform).toBe('windows');
    expect(parseClientPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)').platform).toBe('macos');
    expect(parseClientPlatform('Mozilla/5.0 (X11; Linux x86_64)').platform).toBe('linux');
    expect(parseClientPlatform('Mozilla/5.0 (Linux; Android 14)').platform).toBe('android');
    expect(parseClientPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)').platform).toBe('ios');
    expect(parseClientPlatform('').label).toBe(CLIENT_PLATFORM_LABELS.unknown);
  });
});
