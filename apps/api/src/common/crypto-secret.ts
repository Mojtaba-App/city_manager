import { ConfigService } from '@nestjs/config';

const BANNED_LITERALS = new Set([
  'dev-key',
  'dev-integration-key',
  'dev-secrets-master',
]);

/**
 * Resolve a crypto secret from env without hardcoded fallbacks.
 * Missing / banned values fail fast at service construction (boot).
 */
export function resolveCryptoSecret(
  config: ConfigService,
  preferredKeys: string[],
  purpose: string,
  opts?: { minLength?: number },
): string {
  const minLength = opts?.minLength ?? 16;
  const isProd = (config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) === 'production';

  for (const envKey of preferredKeys) {
    const raw = config.get<string>(envKey);
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const value = raw.trim();

    if (BANNED_LITERALS.has(value)) {
      throw new Error(
        `[crypto] مقدار ناامن برای ${envKey} (${purpose}). کلیدهای پیش‌فرض سخت‌کد مجاز نیستند.`,
      );
    }
    if (value.length < minLength) {
      throw new Error(
        `[crypto] ${envKey} برای ${purpose} باید حداقل ${minLength} کاراکتر باشد.`,
      );
    }
    if (isProd) {
      if (value.length < 32) {
        throw new Error(`[crypto] در production مقدار ${envKey} باید حداقل ۳۲ کاراکتر باشد (${purpose}).`);
      }
      if (/^change_me/i.test(value)) {
        throw new Error(`[crypto] در production مقدار placeholder برای ${envKey} مجاز نیست (${purpose}).`);
      }
    }
    return value;
  }

  throw new Error(
    `[crypto] متغیر محیطی الزامی برای ${purpose} تنظیم نشده است. یکی از موارد را ست کنید: ${preferredKeys.join(', ')}`,
  );
}
