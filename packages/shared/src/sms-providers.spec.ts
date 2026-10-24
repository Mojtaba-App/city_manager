import {
  SMS_IR_DEFAULT_BASE,
  buildSmsConnectionProbe,
  buildSmsIrBulkBody,
  buildSmsIrBulkUrl,
  iranMobileLookupVariants,
  isIranMobile,
  isSmsIrProvider,
  normalizeIranMobile,
  parseSmsIrApiResult,
  smsProviderDefaultBase,
} from './sms-providers';

describe('sms-providers', () => {
  it('detects sms.ir provider', () => {
    expect(isSmsIrProvider('smsir')).toBe(true);
    expect(isSmsIrProvider('sms.ir')).toBe(true);
    expect(isSmsIrProvider('custom', 'https://api.sms.ir/v1')).toBe(true);
    expect(isSmsIrProvider('kavenegar')).toBe(false);
  });

  it('normalizes Iranian mobiles including Persian digits', () => {
    expect(normalizeIranMobile('09123456789')).toBe('09123456789');
    expect(normalizeIranMobile('+98 912 345 6789')).toBe('09123456789');
    expect(normalizeIranMobile('9123456789')).toBe('09123456789');
    expect(normalizeIranMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(isIranMobile('09123456789')).toBe(true);
    expect(isIranMobile('123')).toBe(false);
    expect(iranMobileLookupVariants('09123456789')).toEqual(
      expect.arrayContaining(['09123456789', '9123456789', '+989123456789']),
    );
  });

  it('builds bulk send payload and credit probe', () => {
    expect(smsProviderDefaultBase('smsir')).toBe(SMS_IR_DEFAULT_BASE);
    expect(buildSmsIrBulkUrl('https://api.sms.ir/v1/')).toBe('https://api.sms.ir/v1/send/bulk');
    expect(buildSmsIrBulkBody('30001234567', '09120000000', 'سلام')).toEqual({
      lineNumber: 30001234567,
      messageText: 'سلام',
      mobiles: ['09120000000'],
    });
    const probe = buildSmsConnectionProbe({
      provider: 'smsir',
      apiBaseUrl: SMS_IR_DEFAULT_BASE,
      apiKey: 'secret',
    });
    expect(probe.url).toBe('https://api.sms.ir/v1/credit');
    expect(probe.headers['x-api-key']).toBe('secret');
  });

  it('parses sms.ir status envelope', () => {
    expect(parseSmsIrApiResult({ status: 1, data: 12.5, message: 'موفق' }, true)).toMatchObject({
      ok: true,
      credit: 12.5,
    });
    expect(parseSmsIrApiResult({ status: 0, message: 'کلید نامعتبر' }, true).ok).toBe(false);
  });
});
