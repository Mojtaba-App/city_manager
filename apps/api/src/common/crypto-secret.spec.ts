import { resolveCryptoSecret } from './crypto-secret';

describe('resolveCryptoSecret', () => {
  function config(map: Record<string, string | undefined>) {
    return { get: (k: string) => map[k] } as never;
  }

  it('returns the first configured key', () => {
    expect(
      resolveCryptoSecret(
        config({ PII_ENC_KEY: 'test-pii-key-32-chars-minimum!!' }),
        ['PII_ENC_KEY', 'JWT_SECRET'],
        'pii',
      ),
    ).toBe('test-pii-key-32-chars-minimum!!');
  });

  it('rejects banned literals', () => {
    expect(() =>
      resolveCryptoSecret(config({ PII_ENC_KEY: 'dev-key' }), ['PII_ENC_KEY'], 'pii'),
    ).toThrow(/ناامن/);
  });

  it('fails when no key is set', () => {
    expect(() =>
      resolveCryptoSecret(config({}), ['PII_ENC_KEY', 'JWT_SECRET'], 'pii'),
    ).toThrow(/تنظیم نشده/);
  });

  it('rejects change_me placeholders in production', () => {
    expect(() =>
      resolveCryptoSecret(
        config({
          NODE_ENV: 'production',
          PII_ENC_KEY: 'change_me_separate_32_byte_key_for_pii_encryption',
        }),
        ['PII_ENC_KEY'],
        'pii',
      ),
    ).toThrow(/placeholder/);
  });
});
