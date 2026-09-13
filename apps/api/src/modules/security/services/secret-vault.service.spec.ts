import { ConfigService } from '@nestjs/config';
import { SecretVaultService } from './secret-vault.service';

describe('SecretVaultService', () => {
  const rows = new Map<string, Record<string, unknown>>();

  const repo = {
    find: jest.fn(async ({ where }: { where: { organizationId: string } }) =>
      [...rows.values()].filter((r) => r.organizationId === where.organizationId),
    ),
    findOne: jest.fn(async ({ where }: { where: { organizationId: string; key: string } }) => {
      return rows.get(`${where.organizationId}:${where.key}`) ?? null;
    }),
    create: jest.fn((x) => x),
    save: jest.fn(async (row: Record<string, unknown>) => {
      const key = `${row.organizationId}:${row.key}`;
      const existing = rows.get(key);
      const saved = {
        id: existing?.id ?? 'id-1',
        createdAt: existing?.createdAt ?? new Date(),
        updatedAt: new Date(),
        ...row,
      };
      rows.set(key, saved);
      return saved;
    }),
    delete: jest.fn(async ({ organizationId, key }: { organizationId: string; key: string }) => {
      rows.delete(`${organizationId}:${key}`);
    }),
    count: jest.fn(async () => rows.size),
  };

  const config = {
    get: () => 'vault-master-key-for-tests-32ch',
  } as unknown as ConfigService;

  let svc: SecretVaultService;

  beforeEach(() => {
    rows.clear();
    svc = new SecretVaultService(repo as never, config);
  });

  it('upserts encrypted secret and never returns plaintext in meta', async () => {
    const meta = await svc.upsert('org1', 'SMS_KEY', 'super-secret', 'sms', 'u1');
    expect(meta.key).toBe('SMS_KEY');
    expect(meta.hasValue).toBe(true);
    expect(JSON.stringify(meta)).not.toContain('super-secret');
    expect(meta.keyVersion).toBe(1);
  });

  it('reveal decrypts stored value', async () => {
    await svc.upsert('org1', 'SMS_KEY', 'super-secret', undefined, 'u1');
    await expect(svc.reveal('org1', 'SMS_KEY')).resolves.toBe('super-secret');
  });

  it('rotate increments version', async () => {
    await svc.upsert('org1', 'SMS_KEY', 'v1', undefined, 'u1');
    const rotated = await svc.rotate('org1', 'SMS_KEY', 'v2');
    expect(rotated.keyVersion).toBe(2);
    await expect(svc.reveal('org1', 'SMS_KEY')).resolves.toBe('v2');
  });
});
