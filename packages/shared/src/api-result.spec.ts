import { parseApiResult } from './api-result';

describe('parseApiResult', () => {
  it('passes through success envelopes', () => {
    expect(parseApiResult({ success: true, data: { id: '1' } }, true)).toEqual({
      success: true,
      data: { id: '1' },
    });
  });

  it('reads our error envelope', () => {
    expect(
      parseApiResult({ success: false, error: { code: 'X', message: 'bad' } }, false),
    ).toEqual({ success: false, error: { code: 'X', message: 'bad' } });
  });

  it('keeps login lock metadata', () => {
    const r = parseApiResult(
      {
        success: false,
        error: { code: 'LOGIN_LOCKED', message: 'locked', retryAfterSec: 180, contactAdmin: true },
      },
      false,
    );
    expect(r.error?.retryAfterSec).toBe(180);
    expect(r.error?.contactAdmin).toBe(true);
  });

  it('maps Nest validation bodies to error.message', () => {
    const r = parseApiResult(
      { statusCode: 400, message: ['colorHex must match'], error: 'Bad Request' },
      false,
    );
    expect(r.success).toBe(false);
    expect(r.error?.message).toContain('colorHex');
  });

  it('explains unreachable API instead of a generic failure', () => {
    const r = parseApiResult({}, false);
    expect(r.success).toBe(false);
    expect(r.error?.message).toContain('ارتباط با سرور');
  });
});
