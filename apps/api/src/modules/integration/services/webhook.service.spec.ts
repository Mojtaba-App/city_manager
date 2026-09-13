import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookService } from './webhook.service';
import { SecretsCryptoService } from './secrets-crypto.service';

describe('WebhookService.receive', () => {
  const secrets = new SecretsCryptoService({
    get: (k: string) => {
      if (k === 'NODE_ENV') return 'test';
      if (k === 'PII_ENC_KEY') return 'test-pii-key-32-chars-minimum!!';
      return undefined;
    },
  } as ConfigService);

  const connector = {
    id: 'c1',
    organizationId: 'org1',
    code: 'hook',
    isActive: true,
  };

  const connectorRepo = {
    findOne: jest.fn(async () => connector),
  };
  const eventRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ ...x, id: 'e1' })),
  };
  const connectors = {
    getDecryptedSecrets: jest.fn((): Record<string, unknown> => ({ webhookSecret: 'whsec' })),
  };
  const runner = {
    runWithRecords: jest.fn(async () => ({ data: { id: 'job1' } })),
  };

  const svc = new WebhookService(
    connectorRepo as never,
    eventRepo as never,
    secrets,
    connectors as never,
    runner as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    connectorRepo.findOne.mockResolvedValue(connector);
    connectors.getDecryptedSecrets.mockReturnValue({ webhookSecret: 'whsec' });
    eventRepo.save.mockImplementation(async (x) => ({ ...x, id: x.id ?? 'e1' }));
  });

  it('rejects when webhook secret is missing', async () => {
    connectors.getDecryptedSecrets.mockReturnValue({});
    await expect(
      svc.receive('hook', {}, { a: 1 }, '{"a":1}', 'org1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid signature', async () => {
    await expect(
      svc.receive('hook', { 'x-signature': 'deadbeef' }, { a: 1 }, '{"a":1}', 'org1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts valid raw-body HMAC', async () => {
    const raw = '{"a":1}';
    const sig = secrets.hmacSha256('whsec', raw);
    const res = await svc.receive('hook', { 'x-signature': sig }, { a: 1 }, raw, 'org1');
    expect(res.success).toBe(true);
    expect(runner.runWithRecords).toHaveBeenCalled();
  });
});
