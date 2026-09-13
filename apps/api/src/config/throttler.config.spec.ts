import { ConfigService } from '@nestjs/config';
import { buildThrottlerModuleOptions } from './throttler.config';

function mockConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback,
  } as ConfigService;
}

describe('throttler.config', () => {
  it('builds in-memory throttler options from env', () => {
    const config = mockConfig({
      THROTTLE_TTL: '30',
      THROTTLE_LIMIT: '60',
    });

    expect(buildThrottlerModuleOptions(config)).toEqual({
      throttlers: [
        {
          name: 'default',
          ttl: 30_000,
          limit: 60,
        },
      ],
    });
  });

  it('uses defaults when throttle env vars are missing', () => {
    const config = mockConfig({});

    expect(buildThrottlerModuleOptions(config)).toEqual({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: 120,
        },
      ],
    });
  });
});
