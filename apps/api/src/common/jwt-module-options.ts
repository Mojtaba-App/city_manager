import { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';

/** Shared JWT factory compatible with @nestjs/jwt v11+ (typed expiresIn). */
export function buildJwtModuleOptions(config: ConfigService): JwtModuleOptions {
  const secret = config.getOrThrow<string>('JWT_SECRET');
  const expiresIn = (config.get<string>('JWT_ACCESS_EXPIRES_IN')
    ?? config.get<string>('JWT_EXPIRES_IN')
    ?? '15m') as JwtSignOptions['expiresIn'];
  return {
    secret,
    signOptions: { expiresIn },
  };
}
