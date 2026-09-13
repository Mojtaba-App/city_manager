import { ConfigService } from '@nestjs/config';
import { PiiCryptoService } from './pii-crypto.service';

describe('PiiCryptoService', () => {
  const config = {
    get: (key: string) => (key === 'PII_ENC_KEY' ? 'test-pii-key-32-chars-minimum!!' : undefined),
  } as ConfigService;
  const crypto = new PiiCryptoService(config);

  it('round-trips encrypt/decrypt', () => {
    const plain = '0012345678';
    const enc = crypto.encrypt(plain);
    expect(enc).not.toBe(plain);
    expect(crypto.decrypt(enc)).toBe(plain);
  });

  it('produces different ciphertext each time (random IV)', () => {
    expect(crypto.encrypt('same')).not.toBe(crypto.encrypt('same'));
  });

  it('hashes consistently after trim', () => {
    expect(crypto.hash('  abc  ')).toBe(crypto.hash('abc'));
    expect(crypto.hash('abc')).toHaveLength(64);
  });
});
