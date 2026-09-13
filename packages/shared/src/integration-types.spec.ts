import {
  AUTH_TYPE_LABELS,
  AuthType,
  SYNC_DIRECTION_LABELS,
  SyncDirection,
  TARGET_ENTITY_LABELS,
  IntegrationTargetEntity,
  buildPublicWebhookUrl,
  resolveApiEndpointUrl,
} from './integration-types';

describe('integration-types', () => {
  it('exposes Persian labels for sync, auth, and target entity', () => {
    expect(SYNC_DIRECTION_LABELS[SyncDirection.INBOUND]).toContain('ورودی');
    expect(AUTH_TYPE_LABELS[AuthType.BEARER]).toContain('Bearer');
    expect(TARGET_ENTITY_LABELS[IntegrationTargetEntity.HOUSEHOLD]).toBe('خانوار');
  });

  it('builds org-scoped public webhook URLs safely', () => {
    expect(buildPublicWebhookUrl('http://localhost:3001/api/v1/', 'org-1', 'welfare-api'))
      .toBe('http://localhost:3001/api/v1/integrations/webhooks/org-1/welfare-api');
    expect(buildPublicWebhookUrl('https://api.example.com/v1', 'org a', 'a b'))
      .toBe('https://api.example.com/v1/integrations/webhooks/org%20a/a%20b');
  });

  it('keeps legacy webhook URL builder (code-only)', () => {
    expect(buildPublicWebhookUrl('http://localhost:3001/api/v1/', 'welfare-api'))
      .toBe('http://localhost:3001/api/v1/integrations/webhooks/welfare-api');
  });

  it('resolves docs links without duplicating /api/v1', () => {
    expect(resolveApiEndpointUrl('http://localhost:3001/api/v1', '/integrations/connectors'))
      .toBe('http://localhost:3001/api/v1/integrations/connectors');
    expect(resolveApiEndpointUrl('http://localhost:3001/api/v1', '/api/v1/integrations/connectors'))
      .toBe('http://localhost:3001/api/v1/integrations/connectors');
    expect(resolveApiEndpointUrl('http://localhost:3001/api/v1/', 'integrations/queue'))
      .toBe('http://localhost:3001/api/v1/integrations/queue');
  });
});
