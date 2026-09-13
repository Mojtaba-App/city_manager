import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

const logger = new Logger('ThrottlerConfig');

export type ResolvedThrottlerModuleOptions = {
  throttlers: Array<{
    name: string;
    ttl: number;
    limit: number;
  }>;
  storage?: ThrottlerStorageRedisService;
};

export function buildThrottlerModuleOptions(config: ConfigService): ResolvedThrottlerModuleOptions {
  const throttlers = [
    {
      name: 'default',
      ttl: Number(config.get('THROTTLE_TTL', 60)) * 1000,
      limit: Number(config.get('THROTTLE_LIMIT', 120)),
    },
  ];

  const redisUrl = (config.get<string>('REDIS_URL') ?? '').trim();
  if (redisUrl) {
    logger.log('Rate limit storage: redis');
    return {
      throttlers,
      storage: new ThrottlerStorageRedisService(redisUrl),
    };
  }

  logger.log('Rate limit storage: in-memory');
  return { throttlers };
}
